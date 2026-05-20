import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/auth-middleware";
import { cache } from "../../../lib/cache";
import { z } from "zod";

/**
 * Newsletter / Email Marketing Integration (G-101, G-061, G-134)
 *
 * FIXED MEDIUM: Stored XSS — name/preferences interpolated into email HTML without escaping.
 * FIXED MEDIUM: Email in URL for unsubscribe link — use HMAC-signed token instead of raw email.
 * FIXED MEDIUM: No rate limiting on subscribe POST (email harvesting/flooding).
 * FIXED: Zod v4 compatibility.
 */

function escHtml(val: unknown): string {
  return String(val ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

/** Generate HMAC-signed unsubscribe token to avoid exposing raw email in URLs */
async function makeUnsubscribeToken(email: string): Promise<string> {
  try {
    const secret = process.env.CSRF_SECRET ?? "dev-secret";
    const { createHmac } = await import("crypto");
    const sig = createHmac("sha256", secret).update(email).digest("base64url");
    return `${Buffer.from(email).toString("base64url")}.${sig}`;
  } catch {
    return Buffer.from(email).toString("base64url");
  }
}

/** Verify HMAC unsubscribe token → return email or null */
async function verifyUnsubscribeToken(token: string): Promise<string | null> {
  try {
    const [b64email, sig] = token.split(".");
    if (!b64email || !sig) return null;
    const email = Buffer.from(b64email, "base64url").toString("utf8");
    const expected = await makeUnsubscribeToken(email);
    const [, expectedSig] = expected.split(".");
    const { timingSafeEqual } = await import("crypto");
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig ?? ""))) return null;
    return email;
  } catch {
    return null;
  }
}

const SubscribeSchema = z.object({
  email:       z.string().email(),
  name:        z.string().min(1).max(200).optional(),
  preferences: z.array(z.enum(["promotions","new_products","weekly_deals","restock_alerts"])).max(4).optional().default(["promotions"]),
  source:      z.string().max(50).optional().default("website"),
});

// ── POST /api/newsletter — subscribe ─────────────────────────────────────────
export async function POST(req: Request) {
  try {
    // FIX MEDIUM: Rate limit subscribes to prevent email harvesting/flooding
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const { allowed } = await cache.rateLimit(`newsletter_sub:${ip}`, 5, 3600); // 5 per hour per IP
    if (!allowed) return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });

    const parsed = SubscribeSchema.safeParse(await req.json());
    if (!parsed.success) {
      const msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { email, name, preferences, source } = parsed.data;
    const { prisma } = await import("../../../lib/prisma");

    const existing = await (prisma as any).newsletterSubscription.findUnique({ where: { email } });
    if (existing?.subscribed) {
      return NextResponse.json({ success: true, message: "You are already subscribed." });
    }

    await (prisma as any).newsletterSubscription.upsert({
      where:  { email },
      update: { subscribed: true, name: name ?? existing?.name, preferences: JSON.stringify(preferences), subscribedAt: new Date() },
      create: { email, name: name ?? "", preferences: JSON.stringify(preferences), source, subscribed: true },
    });

    // Send welcome email — FIX: HTML-escape all dynamic values
    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        // FIX MEDIUM: Generate HMAC-signed token for unsubscribe link (not raw email in URL)
        const unsubToken = await makeUnsubscribeToken(email);
        const baseUrl    = process.env.NEXT_PUBLIC_BASE_URL ?? "https://groceryos.example.com";
        const prefLabels = preferences.map(p => escHtml(p.replace(/_/g, " "))).join(", ");

        await resend.emails.send({
          from:    "GroceryOS <onboarding@resend.dev>",
          to:      email,
          subject: "Welcome to GroceryOS offers! 🛒",
          // FIX MEDIUM: All dynamic values HTML-escaped
          html: `<div style="font-family:system-ui;max-width:520px;margin:0 auto;padding:32px;border:1px solid #e2e8f0;border-radius:8px;">
            <h2 style="color:#7c3aed;">Welcome to GroceryOS! 🎉</h2>
            <p>Hi ${escHtml(name ?? "there")},</p>
            <p>Thanks for subscribing! You'll receive <strong>${prefLabels}</strong> updates from us.</p>
            <p style="margin-top:16px;">As a thank you, use code <strong style="color:#7c3aed;font-size:18px;">WELCOME10</strong> for 10% off your first order!</p>
            <p style="color:#94a3b8;font-size:12px;margin-top:24px;">
              <a href="${baseUrl}/api/newsletter/unsubscribe?token=${encodeURIComponent(unsubToken)}" style="color:#7c3aed;">Unsubscribe</a>
            </p>
          </div>`,
        });
      } catch { /* silent — email failure is non-blocking */ }
    }

    return NextResponse.json({ success: true, message: "Subscribed! Check your email for a welcome offer." }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Subscription failed." }, { status: 500 });
  }
}

// ── DELETE /api/newsletter?token=X — unsubscribe via HMAC token ──────────────
export async function DELETE(req: Request) {
  try {
    // FIX MEDIUM: Accept HMAC token instead of raw email parameter
    const url   = new URL(req.url);
    const token = url.searchParams.get("token");
    const emailParam = url.searchParams.get("email"); // legacy fallback

    let email: string | null = null;
    if (token) {
      email = await verifyUnsubscribeToken(token);
      if (!email) return NextResponse.json({ error: "Invalid or expired unsubscribe token." }, { status: 400 });
    } else if (emailParam) {
      // Legacy: accept direct email only for authenticated callers
      const authErr = requireAdmin(req);
      if (authErr) return NextResponse.json({ error: "token required." }, { status: 400 });
      email = emailParam;
    } else {
      return NextResponse.json({ error: "token required." }, { status: 400 });
    }

    const { prisma } = await import("../../../lib/prisma");
    await (prisma as any).newsletterSubscription.update({
      where: { email },
      data:  { subscribed: false, unsubscribedAt: new Date() },
    });

    return NextResponse.json({ success: true, message: "Unsubscribed successfully." });
  } catch {
    return NextResponse.json({ error: "Unsubscribe failed." }, { status: 500 });
  }
}

// ── GET /api/newsletter/unsubscribe?token=X — one-click (RFC 8058) ───────────
export async function GET(req: Request) {
  const url   = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response("<h2>Invalid unsubscribe link.</h2>", { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const email = await verifyUnsubscribeToken(token);
  if (!email) {
    return new Response("<h2>Invalid or expired unsubscribe link.</h2>", { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  try {
    const { prisma } = await import("../../../lib/prisma");
    await (prisma as any).newsletterSubscription.update({
      where: { email },
      data:  { subscribed: false, unsubscribedAt: new Date() },
    });
  } catch { /* if already unsubscribed, ignore */ }

  return new Response(
    `<html><body style="font-family:system-ui;text-align:center;padding:40px;"><h2>✅ Unsubscribed</h2><p>You have been removed from GroceryOS marketing emails.</p><a href="/">Return to Shop</a></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
