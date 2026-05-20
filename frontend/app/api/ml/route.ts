import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/auth-middleware";

/**
 * ML Recommendations — Collaborative Filtering (G-217, G-218)
 * Item-based collaborative filtering: "customers who bought X also bought Y"
 * Demand Forecasting: predict next week's sales from history
 */

// ── GET /api/ml/recommend?productId=X&limit=6 ────────────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type      = searchParams.get("type") ?? "collab";
  const productId = parseInt(searchParams.get("productId") ?? "0", 10);
  const email     = searchParams.get("email");
  const limit     = parseInt(searchParams.get("limit") ?? "6", 10);

  const { prisma } = await import("../../../lib/prisma");

  // ── Item-based collaborative filtering ─────────────────────────────────────
  if (type === "collab" && productId) {
    // Find all orders containing this product
    const ordersWithProduct = await prisma.order.findMany({
      where: { items: { contains: String(productId) } },
      select: { id: true, items: true },
      take: 100,
    });

    // Build co-occurrence map
    const coOccurrence: Record<number, number> = {};
    for (const order of ordersWithProduct) {
      let items: any[] = [];
      try { items = JSON.parse(order.items as string); } catch {}
      for (const item of items) {
        if (item.id !== productId) {
          coOccurrence[item.id] = (coOccurrence[item.id] ?? 0) + 1;
        }
      }
    }

    // Sort by frequency
    const topIds = Object.entries(coOccurrence)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => parseInt(id, 10));

    if (topIds.length === 0) {
      // Fallback: same category
      const source = await prisma.product.findUnique({ where: { id: productId } });
      const similar = await prisma.product.findMany({
        where: { category: source?.category ?? "", id: { not: productId }, enabled: true },
        take: limit,
      });
      return NextResponse.json({ type: "similar_category", products: similar });
    }

    const products = await prisma.product.findMany({
      where: { id: { in: topIds }, enabled: true },
    });
    // Maintain order by frequency
    const ordered = topIds.map(id => products.find(p => p.id === id)).filter(Boolean);
    return NextResponse.json({ type: "collaborative_filtering", products: ordered });
  }

  // ── Demand forecasting ─────────────────────────────────────────────────────
  if (type === "forecast") {
    const authErr = requireAdmin(req);
    if (authErr) return authErr;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const products = await prisma.product.findMany({ where: { enabled: true }, take: 20 });
    const forecasts = [];

    for (const product of products) {
      // Count sales in last 30 days from inventory batches
      const sold = await (prisma as any).inventoryBatch.aggregate({
        where:  { productId: product.id, quantity: { lt: 0 }, createdAt: { gte: thirtyDaysAgo } },
        _sum:   { quantity: true },
      });
      const soldQty       = Math.abs(sold._sum?.quantity ?? 0);
      const dailyRate     = soldQty / 30;
      const weekForecast  = Math.round(dailyRate * 7);
      const daysOfStock   = dailyRate > 0 ? Math.round(product.stock / dailyRate) : 999;
      const reorderSoon   = daysOfStock <= 14;

      forecasts.push({
        productId:    product.id,
        name:         product.name,
        currentStock: product.stock,
        soldLast30d:  soldQty,
        dailyRate:    parseFloat(dailyRate.toFixed(2)),
        forecast7d:   weekForecast,
        daysOfStock:  daysOfStock > 365 ? "365+" : daysOfStock,
        reorderSoon,
        priority:     reorderSoon ? "HIGH" : "LOW",
      });
    }

    return NextResponse.json({
      forecasts: forecasts.sort((a, b) => (a.daysOfStock === "365+" ? 999 : +a.daysOfStock) - (b.daysOfStock === "365+" ? 999 : +b.daysOfStock)),
      generatedAt: new Date().toISOString(),
    });
  }

  // ── Personalized: based on customer history ────────────────────────────────
  if (type === "personal" && email) {
    const recent = await prisma.order.findMany({
      where: { customer: { email } },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    // Extract bought product IDs
    const boughtIds: number[] = [];
    for (const o of recent) {
      try {
        const items = JSON.parse(o.items as string);
        items.forEach((i: any) => { if (!boughtIds.includes(i.id)) boughtIds.push(i.id); });
      } catch {}
    }

    // Recommend from same categories
    const boughtProducts = await prisma.product.findMany({ where: { id: { in: boughtIds } }, select: { category: true } });
    const categories     = [...new Set(boughtProducts.map(p => p.category))];

    const recommended = await prisma.product.findMany({
      where: { category: { in: categories }, id: { notIn: boughtIds }, enabled: true },
      orderBy: { featured: "desc" },
      take:    limit,
    });

    return NextResponse.json({ type: "personalized", products: recommended, basedOn: boughtIds.length });
  }

  return NextResponse.json({ error: "type must be collab|forecast|personal" }, { status: 400 });
}
