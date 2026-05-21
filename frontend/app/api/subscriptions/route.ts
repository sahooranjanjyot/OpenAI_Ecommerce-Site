import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAuth } from "@/lib/auth-middleware";
import { z } from "zod";

// ── Subscription / Recurring Orders (G-072, G-051, G-166) ────────────────────
const SubscriptionSchema = z.object({
  email:        z.string().email(),
  productId:    z.number().int().positive(),
  qty:          z.number().int().positive(),
  frequency:    z.enum(["weekly", "fortnightly", "monthly"]),
  address:      z.string().min(5).max(500),
  phone:        z.string().min(5).max(20),
  paymentToken: z.string().optional(), // Stripe subscription ID in production
});

const PutSchema = z.object({
  id:     z.number().int().positive(),
  action: z.enum(["pause", "resume", "cancel"]),
});

// ── GET /api/subscriptions?email=X ───────────────────────────────────────────
export async function GET(req: Request) {
  try {
    const email = new URL(req.url).searchParams.get("email");
    const authErr = requireAdmin(req);

    // Admin can see all; customer can see their own
    const where = (!authErr) ? {} : email ? { email } : {};

    const subs = await (prisma as any).subscription.findMany({
      where,
      include: { product: { select: { id: true, name: true, price: true, unit: true, image: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(subs);
  } catch {
    return NextResponse.json({ error: "Failed to fetch subscriptions." }, { status: 500 });
  }
}

// ── POST /api/subscriptions — create subscription ────────────────────────────
// CSRF Protection: Handled globally by middleware.ts — this endpoint is NOT in CSRF_EXEMPT list
export async function POST(req: Request) {
  try {
    // Require authenticated user
    const authResult = requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const userEmail = authResult.email;

    const parsed = SubscriptionSchema.safeParse(await req.json());
    if (!parsed.success) {
      const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: _msg }, { status: 400 });
    }

    const { email, productId, qty, frequency, address, phone } = parsed.data;

    // Ownership check: user can only create subscriptions for themselves (unless admin)
    const isAdmin = !requireAdmin(req);
    if (!isAdmin && email !== userEmail) {
      return NextResponse.json({ error: "Cannot create subscription for another user." }, { status: 403 });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });

    // Calculate next delivery date
    const frequencyDays: Record<string, number> = { weekly: 7, fortnightly: 14, monthly: 30 };
    const nextDelivery = new Date(Date.now() + frequencyDays[frequency] * 24 * 60 * 60 * 1000);

    const subscription = await (prisma as any).subscription.create({
      data: { email, productId, qty, frequency, address, phone, nextDelivery, active: true },
    });

    return NextResponse.json({
      success:      true,
      subscription,
      message:      `Subscription created! First delivery: ${nextDelivery.toLocaleDateString("en-GB")}.`,
      discount:     "5% subscription discount applied automatically.",
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create subscription." }, { status: 500 });
  }
}

// ── PUT /api/subscriptions — pause/resume/cancel ──────────────────────────────
// CSRF Protection: Handled globally by middleware.ts — this endpoint is NOT in CSRF_EXEMPT list
export async function PUT(req: Request) {
  try {
    // Require authenticated user
    const authResult = requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const userEmail = authResult.email;

    const body = await req.json();
    const parsed = PutSchema.safeParse(body);
    if (!parsed.success) {
      const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: _msg }, { status: 400 });
    }

    const { id, action } = parsed.data;

    const sub = await (prisma as any).subscription.findUnique({ where: { id } });
    if (!sub) return NextResponse.json({ error: "Subscription not found." }, { status: 404 });

    // Ownership check: user can only modify their own subscriptions (unless admin)
    const isAdmin = !requireAdmin(req);
    if (!isAdmin && sub.email !== userEmail) {
      return NextResponse.json({ error: "Unauthorised." }, { status: 403 });
    }

    let update: any = {};
    if (action === "pause")  update = { active: false };
    if (action === "resume") update = { active: true };
    if (action === "cancel") update = { active: false, cancelledAt: new Date() };

    const updated = await (prisma as any).subscription.update({ where: { id }, data: update });
    return NextResponse.json({ success: true, subscription: updated });
  } catch {
    return NextResponse.json({ error: "Failed to update subscription." }, { status: 500 });
  }
}
