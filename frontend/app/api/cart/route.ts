import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { requireAdmin } from "../../../lib/auth-middleware";
import { cache } from "../../../lib/cache";
import { z } from "zod";

// ── Abandoned Cart Persistence (G-030, G-069) ─────────────────────────────────
const CartSchema = z.object({
  sessionId: z.string().min(1).max(100),
  email:     z.string().email().optional(),
  items:     z.array(z.object({
    id: z.number(), name: z.string(), price: z.number(), qty: z.number(),
  })),
});

// ── GET — restore cart ────────────────────────────────────────────────────────
// NOTE: Cart data is accessible by sessionId (random UUID). While UUIDs are hard to guess,
// for enhanced security, consider binding carts to authenticated user sessions where possible.
// The current implementation relies on sessionId secrecy for anonymous/guest carts.
export async function GET(req: Request) {
  try {
    // Rate limiting: 60 requests per IP per minute to prevent sessionId enumeration
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
               req.headers.get("x-real-ip") || 
               "unknown";
    const rateLimitKey = `cart:get:${ip}`;
    const { limited } = await cache.rateLimit(rateLimitKey, 60, 60);
    if (limited) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const sessionId = new URL(req.url).searchParams.get("sessionId");
    if (!sessionId) return NextResponse.json({ items: [] });

    const cart = await (prisma as any).abandonedCart.findUnique({ where: { sessionId } });
    if (!cart) return NextResponse.json({ items: [] });

    return NextResponse.json({ items: JSON.parse(cart.items), email: cart.email, updatedAt: cart.updatedAt });
  } catch {
    return NextResponse.json({ items: [] });
  }
}

// ── POST — save/update cart ───────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const parsed = CartSchema.safeParse(await req.json());
    if (!parsed.success) { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }

    const { sessionId, email, items } = parsed.data;

    if (items.length === 0) {
      // Clear cart on checkout
      await (prisma as any).abandonedCart.deleteMany({ where: { sessionId } });
      return NextResponse.json({ success: true });
    }

    const cart = await (prisma as any).abandonedCart.upsert({
      where:  { sessionId },
      update: { items: JSON.stringify(items), email: email ?? null, updatedAt: new Date() },
      create: { sessionId, items: JSON.stringify(items), email: email ?? null },
    });

    return NextResponse.json({ success: true, id: cart.id });
  } catch {
    return NextResponse.json({ error: "Failed to save cart." }, { status: 500 });
  }
}

// ── GET /api/cart/abandoned — admin: list abandoned carts ────────────────────
// (accessed via /api/cart?admin=1)
export async function PUT(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    // Carts not updated in last 1 hour = abandoned
    const cutoff = new Date(Date.now() - 60 * 60 * 1000);
    const carts  = await (prisma as any).abandonedCart.findMany({
      where:   { updatedAt: { lte: cutoff } },
      orderBy: { updatedAt: "desc" },
      take:    100,
    });
    return NextResponse.json(carts);
  } catch {
    return NextResponse.json({ error: "Failed to fetch abandoned carts." }, { status: 500 });
  }
}
