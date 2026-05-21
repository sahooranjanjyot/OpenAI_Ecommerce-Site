import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAuth } from "@/lib/auth-middleware";
import { cache } from "@/lib/cache";
import { z } from "zod";

// ── Back-in-Stock Notifications (G-058, G-062, G-071) ────────────────────────
const SubscribeSchema = z.object({
  email:     z.string().email(),
  productId: z.number().int().positive(),
});

// ── GET /api/notifications/backInStock — admin: list all subscriptions ────────
export async function GET(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const subs = await (prisma as any).backInStockAlert.findMany({
      include: { product: { select: { id: true, name: true, stock: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(subs);
  } catch {
    return NextResponse.json({ error: "Failed to fetch subscriptions." }, { status: 500 });
  }
}

// ── POST /api/notifications/backInStock — subscribe ───────────────────────────
export async function POST(req: Request) {
  // Require authentication
  const authResult = requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  // Rate limiting: 10 subscriptions per IP per hour
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  const rateLimitKey = `backInStock:subscribe:${ip}`;
  const { allowed: rateLimitOk } = await cache.rateLimit(rateLimitKey, 10, 3600);
  if (!rateLimitOk) {
    return NextResponse.json({ error: "Too many subscription requests. Please try again later." }, { status: 429 });
  }

  try {
    const parsed = SubscribeSchema.safeParse(await req.json());
    if (!parsed.success) { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }

    const { email, productId } = parsed.data;

    // Only allow users to register notifications for their own email
    if (email.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json({ error: "You can only subscribe using your own email address." }, { status: 403 });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });

    if (product.stock > 0) {
      return NextResponse.json({ error: "This product is currently in stock.", inStock: true }, { status: 400 });
    }

    const existing = await (prisma as any).backInStockAlert.findFirst({ where: { email, productId } });
    if (existing) return NextResponse.json({ success: true, message: "You are already subscribed." });

    await (prisma as any).backInStockAlert.create({ data: { email, productId } });
    return NextResponse.json({ success: true, message: `We will notify ${email} when "${product.name}" is back in stock.` }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to subscribe." }, { status: 500 });
  }
}

// ── DELETE — unsubscribe ──────────────────────────────────────────────────────
export async function DELETE(req: Request) {
  try {
    const { email, productId } = await req.json();
    await (prisma as any).backInStockAlert.deleteMany({ where: { email, productId } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to unsubscribe." }, { status: 500 });
  }
}
