import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { z } from "zod";
import { requireAuth } from "../../../lib/auth-middleware";
import { cache } from "../../../lib/cache";

// ── Wishlist — stored per session/customer email (G-058/G-068/G-096) ──────────
// CSRF protection is handled globally by middleware

const WishlistSchema = z.object({
  productId: z.number().int().positive(),
});

// ── GET /api/wishlist — fetch wishlist for authenticated user ─────────────────
export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const items = await (prisma as any).wishlistItem.findMany({
      where:   { email: auth.user.email },
      include: { product: { select: { id: true, name: true, price: true, image: true, stock: true, unit: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(items);
  } catch {
    return NextResponse.json({ error: "Failed to fetch wishlist." }, { status: 500 });
  }
}

// ── POST /api/wishlist — add item ─────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    // Rate limiting: 20 mutations per IP per hour
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    const rateLimitKey = `wishlist:post:${ip}`;
    const isAllowed = await cache.rateLimit(rateLimitKey, 20, 3600);
    if (!isAllowed) {
      return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });
    }

    const parsed = WishlistSchema.safeParse(await req.json());
    if (!parsed.success) {
      const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: _msg }, { status: 400 });
    }

    const { productId } = parsed.data;
    const email = auth.user.email;

    // Upsert — no duplicates
    const existing = await (prisma as any).wishlistItem.findFirst({ where: { email, productId } });
    if (existing) return NextResponse.json({ success: true, message: "Already in wishlist." });

    const item = await (prisma as any).wishlistItem.create({ data: { email, productId } });
    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to add to wishlist." }, { status: 500 });
  }
}

// ── DELETE /api/wishlist?productId=y — remove item ────────────────────────────
export async function DELETE(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    // Rate limiting: 20 mutations per IP per hour
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    const rateLimitKey = `wishlist:delete:${ip}`;
    const isAllowed = await cache.rateLimit(rateLimitKey, 20, 3600);
    if (!isAllowed) {
      return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const productId = parseInt(searchParams.get("productId") ?? "0", 10);

    if (!productId) return NextResponse.json({ error: "productId required." }, { status: 400 });

    const email = auth.user.email;

    await (prisma as any).wishlistItem.deleteMany({ where: { email, productId } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to remove from wishlist." }, { status: 500 });
  }
}
