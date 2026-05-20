import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { cache } from "../../../lib/cache";
import { getSession } from "../../../lib/auth-middleware";
import { z } from "zod";

// ── Recently Viewed + Product Recommendations (G-099, G-100, G-098) ───────────
// FIXED: POST now requires auth — client-supplied email was IDOR/privacy risk.

// ── GET /api/recommendations?productId=X — similar products ──────────────────
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = parseInt(searchParams.get("productId") ?? "0", 10);
    const email     = searchParams.get("email");
    const type      = searchParams.get("type") ?? "similar"; // similar | recently_viewed | trending

    if (type === "recently_viewed" && email) {
      const viewed = await (prisma as any).recentlyViewed.findMany({
        where:   { email },
        include: { product: true },
        orderBy: { viewedAt: "desc" },
        take:    10,
      });
      return NextResponse.json(viewed.map((v: any) => v.product));
    }

    if (type === "trending") {
      // Most ordered in last 7 days
      const recentBatches = await (prisma as any).inventoryBatch.findMany({
        where:   { quantity: { lt: 0 }, createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
        include: { product: { select: { id: true, name: true, price: true, category: true, image: true, stock: true, unit: true } } },
      });
      const tally: Record<number, { product: any; sold: number }> = {};
      for (const b of recentBatches) {
        if (!tally[b.productId]) tally[b.productId] = { product: b.product, sold: 0 };
        tally[b.productId].sold += Math.abs(b.quantity);
      }
      return NextResponse.json(Object.values(tally).sort((a, b) => b.sold - a.sold).slice(0, 10).map(t => t.product));
    }

    // Default: similar products (same category)
    if (productId) {
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) return NextResponse.json([]);

      const similar = await prisma.product.findMany({
        where:   { category: product.category, id: { not: productId }, enabled: true },
        orderBy: { featured: "desc" },
        take:    6,
      });
      return NextResponse.json(similar);
    }

    // Featured products fallback
    const featured = await prisma.product.findMany({ where: { featured: true, enabled: true }, take: 8 });
    return NextResponse.json(featured);
  } catch {
    return NextResponse.json({ error: "Failed to get recommendations." }, { status: 500 });
  }
}

// ── POST /api/recommendations — record product view (requires auth) ──────────
export async function POST(req: Request) {
  try {
    // FIXED: Rate limit — prevent flooding
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const { allowed } = await cache.rateLimit(`rec_view:${ip}`, 30, 3600);
    if (!allowed) return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });

    // FIXED IDOR: Require auth — use server-side email from session, not client-supplied
    const session = await getSession(req);
    const email   = session?.email;

    const body = await req.json();
    const productId = parseInt(String(body.productId ?? "0"), 10);
    if (!productId || productId <= 0) {
      return NextResponse.json({ error: "Valid productId required." }, { status: 400 });
    }

    if (email) {
      await (prisma as any).recentlyViewed.upsert({
        where:  { email_productId: { email, productId } },
        update: { viewedAt: new Date() },
        create: { email, productId, viewedAt: new Date() },
      });
    }
    // If no session, silently succeed (anonymous browsing — no PII stored)
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to record view." }, { status: 500 });
  }
}
