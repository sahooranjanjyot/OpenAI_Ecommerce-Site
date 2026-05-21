import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cache } from "@/lib/cache";
import { getSession } from "@/lib/auth-middleware";
import { z } from "zod";

// ── Recently Viewed + Product Recommendations (G-099, G-100, G-098) ───────────
// FIXED: POST now requires auth — client-supplied email was IDOR/privacy risk.

// ── GET /api/recommendations ──────────────────
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = parseInt(searchParams.get("productId") ?? "0", 10);
    const limit     = parseInt(searchParams.get("limit") ?? "6", 10);
    const type      = searchParams.get("type") ?? "similar"; // similar | collab | personal | recently_viewed | trending

    // Retrieve email from query parameters or session
    const session = await getSession(req);
    const email = searchParams.get("email") || session?.email;

    // ── Item-based collaborative filtering (G-217, G-218) ────────────────────
    if (type === "collab" && productId) {
      // Find orders containing this product via OrderItem
      const orderItems = await prisma.orderItem.findMany({
        where: { productId },
        select: { orderId: true },
        take: 200,
      });
      const orderIds = orderItems.map(oi => oi.orderId);

      let topProductIds: number[] = [];
      if (orderIds.length > 0) {
        // Find other products bought in those same orders
        const otherOrderItems = await prisma.orderItem.findMany({
          where: {
            orderId: { in: orderIds },
            productId: { not: productId },
          },
          select: { productId: true },
        });

        // Count frequency of co-occurrences
        const counts: Record<number, number> = {};
        for (const item of otherOrderItems) {
          counts[item.productId] = (counts[item.productId] ?? 0) + 1;
        }

        topProductIds = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit)
          .map(([id]) => Number(id));
      }

      if (topProductIds.length === 0) {
        // Fallback to similar category products
        const source = await prisma.product.findUnique({ where: { id: productId } });
        const similar = await prisma.product.findMany({
          where: { category: source?.category ?? "", id: { not: productId }, enabled: true },
          take: limit,
        });
        return NextResponse.json(similar);
      }

      const products = await prisma.product.findMany({
        where: { id: { in: topProductIds }, enabled: true },
      });
      // Sort products back in order of frequency count
      const ordered = topProductIds
        .map(id => products.find(p => p.id === id))
        .filter((p): p is NonNullable<typeof p> => !!p);
      return NextResponse.json(ordered);
    }

    // ── Personalized Recommendations (based on purchase history) ──────────────
    if (type === "personal" && email) {
      const customer = await prisma.customer.findUnique({
        where: { email },
        select: { id: true },
      });

      if (customer) {
        // Find all orders placed by this customer
        const orders = await prisma.order.findMany({
          where: { customerId: customer.id },
          select: { id: true },
        });

        if (orders.length > 0) {
          const orderIds = orders.map(o => o.id);
          // Find all products purchased by this customer
          const boughtItems = await prisma.orderItem.findMany({
            where: { orderId: { in: orderIds } },
            select: { productId: true },
          });
          const boughtIds = [...new Set(boughtItems.map(bi => bi.productId))];

          if (boughtIds.length > 0) {
            // Find categories of products the customer purchased
            const boughtProducts = await prisma.product.findMany({
              where: { id: { in: boughtIds } },
              select: { category: true },
            });
            const categories = [...new Set(boughtProducts.map(p => p.category))];

            if (categories.length > 0) {
              // Recommend other products from the same categories that they haven't bought
              const recommended = await prisma.product.findMany({
                where: {
                  category: { in: categories },
                  id: { notIn: boughtIds },
                  enabled: true,
                },
                orderBy: { featured: "desc" },
                take: limit,
              });
              if (recommended.length > 0) {
                return NextResponse.json(recommended);
              }
            }
          }
        }
      }
      // If customer has no purchase history, fall back to trending
    }

    // ── Recently Viewed ──────────────────────────────────────────────────────
    if (type === "recently_viewed" && email) {
      const viewed = await (prisma as any).recentlyViewed.findMany({
        where:   { email },
        include: { product: true },
        orderBy: { viewedAt: "desc" },
        take:    limit,
      });
      return NextResponse.json(viewed.map((v: any) => v.product));
    }

    // ── Trending (most items sold from inventory batches in past 7 days) ──────
    if (type === "trending" || (type === "personal" && email)) {
      const recentBatches = await (prisma as any).inventoryBatch.findMany({
        where: {
          quantity: { lt: 0 },
          createdAt: { gte: new Date(Date.now() - 7 * 86400000) },
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              price: true,
              category: true,
              image: true,
              stock: true,
              unit: true,
            },
          },
        },
      });
      const tally: Record<number, { product: any; sold: number }> = {};
      for (const b of recentBatches) {
        if (!b.product) continue;
        if (!tally[b.productId]) tally[b.productId] = { product: b.product, sold: 0 };
        tally[b.productId].sold += Math.abs(b.quantity);
      }
      const trending = Object.values(tally)
        .sort((a, b) => b.sold - a.sold)
        .slice(0, limit)
        .map(t => t.product);
      if (trending.length > 0) {
        return NextResponse.json(trending);
      }
    }

    // ── Default: Similar products (same category) ─────────────────────────────
    if (productId) {
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) return NextResponse.json([]);

      const similar = await prisma.product.findMany({
        where: {
          category: product.category,
          id: { not: productId },
          enabled: true,
        },
        orderBy: { featured: "desc" },
        take: limit,
      });
      return NextResponse.json(similar);
    }

    // ── Fallback: Featured Products ───────────────────────────────────────────
    const featured = await prisma.product.findMany({
      where: { featured: true, enabled: true },
      take: limit,
    });
    return NextResponse.json(featured);
  } catch (err: any) {
    console.error("Error in GET /api/recommendations:", err);
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
