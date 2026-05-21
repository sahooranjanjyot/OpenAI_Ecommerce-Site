import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-middleware";
import { z } from "zod";

/**
 * UGC Moderation Queue (G-147, G-144)
 * Moderates reviews, Q&A, and other user-generated content
 * Auto-flags: profanity, spam patterns, excessive URLs
 */

// Simple moderation patterns
const PROFANITY_LIST = ["badword1", "badword2"]; // extend with real list
const SPAM_PATTERNS  = [
  /http[s]?:\/\//gi,              // URLs in reviews
  /click here/gi,
  /\$\d+/g,                      // Money spam
  /[A-Z]{5,}/g,                  // ALL CAPS
];

function moderateContent(text: string): { flagged: boolean; reasons: string[]; score: number } {
  const reasons: string[] = [];
  let score = 0;

  // Profanity check
  for (const word of PROFANITY_LIST) {
    if (text.toLowerCase().includes(word)) { reasons.push("profanity"); score += 30; break; }
  }

  // Spam checks
  const urlCount = (text.match(/http[s]?:\/\//gi) ?? []).length;
  if (urlCount >= 2) { reasons.push("multiple_urls"); score += 20; }
  if (/\$\d+/.test(text)) { reasons.push("spam_pattern"); score += 15; }
  if ((text.match(/[A-Z]{5,}/g) ?? []).length >= 3) { reasons.push("excessive_caps"); score += 10; }

  // Very short content
  if (text.trim().length < 10) { reasons.push("too_short"); score += 5; }

  // Same character repeated
  if (/(.)\1{4,}/.test(text)) { reasons.push("repeated_chars"); score += 10; }

  return { flagged: score >= 20, reasons, score };
}

// ── GET /api/moderation — admin: content queue ────────────────────────────────
export async function GET(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const { prisma } = await import("@/lib/prisma");
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? "pending";

    const queue = await (prisma as any).moderationQueue.findMany({
      where:   { status },
      orderBy: [{ score: "desc" }, { createdAt: "asc" }],
      take:    50,
    });
    return NextResponse.json(queue);
  } catch {
    return NextResponse.json({ error: "Failed to fetch queue." }, { status: 500 });
  }
}

// ── POST /api/moderation — submit content for moderation ─────────────────────
export async function POST(req: Request) {
  try {
    const { prisma } = await import("@/lib/prisma");
    const { type, content, author, email, referenceId } = await req.json();
    if (!type || !content) return NextResponse.json({ error: "type and content required." }, { status: 400 });

    const { flagged, reasons, score } = moderateContent(content);

    const item = await (prisma as any).moderationQueue.create({
      data: {
        type,              // "review" | "qa" | "comment"
        content,
        author:      author ?? "Anonymous",
        email:       email ?? "",
        referenceId: referenceId ?? 0,
        flagged,
        reasons:     JSON.stringify(reasons),
        score,
        status:      flagged ? "flagged" : "approved",
      },
    });

    return NextResponse.json({
      success:  true,
      id:       item.id,
      status:   item.status,
      flagged,
      message:  flagged
        ? "Your content is under review and will be published once approved."
        : "Content published.",
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Moderation submission failed." }, { status: 500 });
  }
}

// ── PUT /api/moderation — admin: approve/reject ───────────────────────────────
export async function PUT(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const { prisma } = await import("@/lib/prisma");
    const { id, status, note } = await req.json(); // status: approved|rejected
    const item = await (prisma as any).moderationQueue.update({
      where: { id },
      data:  { status, moderatorNote: note, moderatedAt: new Date() },
    });
    return NextResponse.json(item);
  } catch {
    return NextResponse.json({ error: "Failed to moderate content." }, { status: 500 });
  }
}
