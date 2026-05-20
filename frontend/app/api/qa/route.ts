import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, getAuthUser } from "../../../lib/auth-middleware";
import { cache } from "../../../lib/cache";

/**
 * Product Q&A System (G-161, G-146)
 * Customers ask questions; staff or community answer
 */

const QuestionSchemaAuthenticated = z.object({
  productId: z.number().int().positive(),
  question:  z.string().min(10).max(500),
  author:    z.string().min(1).max(100),
  email:     z.string().email().optional(),
});

const QuestionSchemaAnonymous = z.object({
  productId: z.number().int().positive(),
  question:  z.string().min(10).max(500),
  author:    z.string().min(1).max(100),
  email:     z.string().email(),
});

const AnswerSchema = z.object({
  questionId: z.number().int().positive(),
  answer:     z.string().min(5).max(2000),
  answeredBy: z.string().min(1).max(100),
  isStaff:   z.boolean().optional().default(false),
});

// ── GET /api/qa?productId=X — public: get Q&A for product ────────────────────
export async function GET(req: Request) {
  try {
    const { prisma } = await import("../../../lib/prisma");
    const productId = parseInt(new URL(req.url).searchParams.get("productId") ?? "0", 10);
    const where: any = { answered: true };
    if (productId) where.productId = productId;

    const qa = await (prisma as any).productQA.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take:    20,
    });
    return NextResponse.json(qa);
  } catch {
    return NextResponse.json({ error: "Failed to fetch Q&A." }, { status: 500 });
  }
}

// ── POST /api/qa — submit question (rate limited, auth optional) ──────────────
export async function POST(req: Request) {
  try {
    // Rate limit: 5 questions per IP per 10 minutes
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateLimitKey = `qa:submit:${ip}`;
    const isAllowed = await cache.rateLimit(rateLimitKey, 5, 600);
    if (!isAllowed) {
      return NextResponse.json({ error: "Rate limit exceeded. Please wait before submitting more questions." }, { status: 429 });
    }

    const { prisma } = await import("../../../lib/prisma");
    const body = await req.json();
    
    // Check if user is authenticated
    const user = await getAuthUser(req);
    
    let validatedData: { productId: number; question: string; author: string; email?: string };
    let userId: string | null = null;
    
    if (user) {
      // Authenticated user: email is optional, attach userId
      const parsed = QuestionSchemaAuthenticated.safeParse(body);
      if (!parsed.success) {
        const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
        return NextResponse.json({ error: _msg }, { status: 400 });
      }
      validatedData = parsed.data;
      userId = user.id;
      // Use user's email if not provided
      if (!validatedData.email && user.email) {
        validatedData.email = user.email;
      }
    } else {
      // Anonymous user: email is required
      const parsed = QuestionSchemaAnonymous.safeParse(body);
      if (!parsed.success) {
        const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
        return NextResponse.json({ error: _msg }, { status: 400 });
      }
      validatedData = parsed.data;
    }

    const qa = await (prisma as any).productQA.create({
      data: { 
        ...validatedData, 
        answered: false,
        ...(userId && { userId }),
      },
    });
    return NextResponse.json({ success: true, id: qa.id, message: "Question submitted. We'll answer shortly." }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to submit question." }, { status: 500 });
  }
}

// ── PUT /api/qa — admin: answer question ──────────────────────────────────────
export async function PUT(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const { prisma } = await import("../../../lib/prisma");
    const parsed = AnswerSchema.safeParse(await req.json());
    if (!parsed.success) { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }

    const { questionId, ...data } = parsed.data;
    const qa = await (prisma as any).productQA.update({
      where: { id: questionId },
      data:  { ...data, answered: true, answeredAt: new Date() },
    });
    return NextResponse.json(qa);
  } catch {
    return NextResponse.json({ error: "Failed to answer question." }, { status: 500 });
  }
}
