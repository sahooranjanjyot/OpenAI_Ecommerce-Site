import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-middleware";

/**
 * GET /api/reports/sales
 * Sales and profit margin reports (G-056, G-057) — admin only
 *
 * Query params:
 *   ?from=2026-01-01&to=2026-12-31
 *   ?group=day|week|month   (default: day)
 */
export async function GET(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  try {
    const { searchParams } = new URL(req.url);
    const from  = searchParams.get("from");
    const to    = searchParams.get("to");

    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from);
    if (to)   dateFilter.lte = new Date(to);

    // Fetch orders
    const orders = await prisma.order.findMany({
      where:   { ...(from || to ? { createdAt: dateFilter } : {}) },
      include: {
        customer: { select: { name: true } },
        items: { include: { product: { select: { name: true } } } },
      },
      orderBy: { createdAt: "asc" },
    });

    // Revenue summary (prices in DB are in pence, convert to pounds)
    const totalRevenuePence = orders.reduce((s, o) => s + o.total, 0);
    const totalRevenue      = totalRevenuePence / 100;
    const vatCollected      = parseFloat((totalRevenue - totalRevenue / 1.2).toFixed(2));
    const revenueExVAT      = parseFloat((totalRevenue / 1.2).toFixed(2));
    const ordersCount       = orders.length;
    const avgOrderValue     = ordersCount > 0 ? parseFloat((totalRevenue / ordersCount).toFixed(2)) : 0;

    // Orders by status
    const byStatus: Record<string, { count: number; revenue: number }> = {};
    for (const order of orders) {
      const s = order.status ?? "unknown";
      if (!byStatus[s]) byStatus[s] = { count: 0, revenue: 0 };
      byStatus[s].count++;
      byStatus[s].revenue = parseFloat((byStatus[s].revenue + order.total / 100).toFixed(2));
    }

    // Daily revenue buckets
    const byDay: Record<string, { orders: number; revenue: number }> = {};
    for (const order of orders) {
      const day = order.createdAt.toISOString().split("T")[0];
      if (!byDay[day]) byDay[day] = { orders: 0, revenue: 0 };
      byDay[day].orders++;
      byDay[day].revenue = parseFloat((byDay[day].revenue + order.total / 100).toFixed(2));
    }

    // Top products by revenue
    const productRevenue: Record<string, { name: string; qty: number; revenue: number }> = {};
    for (const order of orders) {
      if (order.items) {
        for (const item of order.items) {
          const key = item.productId.toString();
          const pName = item.product?.name ?? `Product #${item.productId}`;
          if (!productRevenue[key]) productRevenue[key] = { name: pName, qty: 0, revenue: 0 };
          productRevenue[key].qty     += item.quantity;
          productRevenue[key].revenue  = parseFloat((productRevenue[key].revenue + (item.price / 100) * item.quantity).toFixed(2));
        }
      }
    }

    const topProducts = Object.values(productRevenue)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Low stock alerts (G-053)
    const LOW_STOCK_THRESHOLD = 10;
    const lowStockProducts = await prisma.product.findMany({
      where:   { stock: { lte: LOW_STOCK_THRESHOLD }, enabled: true },
      select:  { id: true, name: true, category: true, stock: true, unit: true },
      orderBy: { stock: "asc" },
    });

    return NextResponse.json({
      summary: {
        totalRevenue:  parseFloat(totalRevenue.toFixed(2)),
        revenueExVAT,
        vatCollected,
        ordersCount,
        avgOrderValue,
        period: { from: from ?? "all", to: to ?? "all" },
      },
      byStatus,
      dailyRevenue:  byDay,
      topProducts,
      lowStockAlerts: {
        threshold: LOW_STOCK_THRESHOLD,
        products:  lowStockProducts,
        count:     lowStockProducts.length,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to generate report." }, { status: 500 });
  }
}
