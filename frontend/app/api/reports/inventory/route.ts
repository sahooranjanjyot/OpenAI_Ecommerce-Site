import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-middleware";
import { z } from "zod";

/**
 * GET /api/reports/inventory
 * Full inventory valuation report (G-056, G-057, G-127, G-130) — admin only
 */
export async function GET(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  try {
    // Import prisma here to avoid circular refs
    const { prisma } = await import("@/lib/prisma");

    const products = await prisma.product.findMany({
      include: { inventoryBatches: { orderBy: { createdAt: "desc" }, take: 5 } },
      orderBy: { category: "asc" },
    });

    // Build inventory report
    const byCategory: Record<string, { count: number; totalStock: number; totalValue: number; lowStock: number }> = {};
    let grandTotalValue = 0;
    let totalSKUs       = 0;
    let lowStockCount   = 0;
    let outOfStockCount = 0;

    const items = products.map(p => {
      const latestBatch = p.inventoryBatches.find(b => b.quantity > 0);
      const costPricePence = (latestBatch as any)?.costPrice ?? 0;
      const pricePounds  = p.price / 100;
      const costPounds   = costPricePence / 100;
      const stockValue   = pricePounds * p.stock;
      const costValue    = costPounds * p.stock;
      const margin       = costPricePence > 0 ? parseFloat(((p.price - costPricePence) / p.price * 100).toFixed(1)) : null;

      grandTotalValue += stockValue;
      totalSKUs++;
      if (p.stock <= 10 && p.stock > 0) lowStockCount++;
      if (p.stock <= 0) outOfStockCount++;

      if (!byCategory[p.category]) {
        byCategory[p.category] = { count: 0, totalStock: 0, totalValue: 0, lowStock: 0 };
      }
      byCategory[p.category].count++;
      byCategory[p.category].totalStock += p.stock;
      byCategory[p.category].totalValue  = parseFloat((byCategory[p.category].totalValue + stockValue).toFixed(2));
      if (p.stock <= 10) byCategory[p.category].lowStock++;

      return {
        id: p.id, name: p.name, category: p.category,
        price: pricePounds, costPrice: costPounds, stock: p.stock, unit: p.unit,
        stockValue: parseFloat(stockValue.toFixed(2)),
        costValue:  parseFloat(costValue.toFixed(2)),
        margin,
        status: p.stock <= 0 ? "out_of_stock" : p.stock <= 3 ? "critical" : p.stock <= 10 ? "low" : "ok",
      };
    });

    return NextResponse.json({
      summary: {
        totalSKUs,
        totalStockValue:    parseFloat(grandTotalValue.toFixed(2)),
        lowStockCount,
        outOfStockCount,
        generatedAt:        new Date().toISOString(),
      },
      byCategory,
      items,
    });
  } catch {
    return NextResponse.json({ error: "Failed to generate inventory report." }, { status: 500 });
  }
}
