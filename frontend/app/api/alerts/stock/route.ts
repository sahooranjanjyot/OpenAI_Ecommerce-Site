import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-middleware";

// ── Low Stock Alert + Reorder Notifications (G-053, G-054, G-036) ─────────────

const LOW_STOCK_THRESHOLD  = parseInt(process.env.LOW_STOCK_THRESHOLD ?? "10", 10);
const CRITICAL_STOCK_LEVEL = parseInt(process.env.CRITICAL_STOCK_LEVEL ?? "3",  10);

// ── GET /api/alerts/stock — admin: get stock alerts ───────────────────────────
export async function GET(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  try {
    const [lowStock, outOfStock, recentSales] = await Promise.all([
      // Low stock
      prisma.product.findMany({
        where:   { stock: { gt: 0, lte: LOW_STOCK_THRESHOLD }, enabled: true },
        select:  { id: true, name: true, category: true, stock: true, unit: true },
        orderBy: { stock: "asc" },
      }),
      // Out of stock
      prisma.product.findMany({
        where:   { stock: { lte: 0 }, enabled: true },
        select:  { id: true, name: true, category: true, stock: true, unit: true },
        orderBy: { name: "asc" },
      }),
      // Sales velocity — items sold in last 7 days
      (prisma as any).inventoryBatch.findMany({
        where:   {
          quantity:  { lt: 0 },
          channel:   { in: ["online", "instore"] },
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        include: { product: { select: { name: true, stock: true } } },
      }),
    ]);

    // Aggregate sales velocity per product
    const salesVelocity: Record<number, { name: string; soldLast7Days: number; currentStock: number; daysRemaining: number | null }> = {};
    for (const batch of recentSales) {
      const id = batch.productId;
      if (!salesVelocity[id]) {
        salesVelocity[id] = { name: batch.product.name, soldLast7Days: 0, currentStock: batch.product.stock, daysRemaining: null };
      }
      salesVelocity[id].soldLast7Days += Math.abs(batch.quantity);
    }
    for (const item of Object.values(salesVelocity)) {
      const dailyRate = item.soldLast7Days / 7;
      item.daysRemaining = dailyRate > 0 ? parseFloat((item.currentStock / dailyRate).toFixed(1)) : null;
    }

    return NextResponse.json({
      summary: {
        lowStockCount:   lowStock.length,
        outOfStockCount: outOfStock.length,
        criticalCount:   lowStock.filter((p: any) => p.stock <= CRITICAL_STOCK_LEVEL).length,
      },
      lowStock,
      outOfStock,
      salesVelocity: Object.entries(salesVelocity)
        .map(([id, v]) => ({ productId: parseInt(id), ...v }))
        .sort((a, b) => (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999)),
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch stock alerts." }, { status: 500 });
  }
}

// ── POST /api/alerts/stock — trigger reorder notification ────────────────────
export async function POST(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  try {
    const { productId, supplierId, reorderQty } = await req.json();

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });

    // Log reorder request (in production: trigger email/Slack/PO system)
    await (prisma as any).auditLog.create({
      data: {
        action:   "REORDER_REQUEST",
        resource: `Product:${productId}`,
        userId:   "admin",
        ip:       "system",
        payload:  JSON.stringify({ productId, supplierId, reorderQty, stock: product.stock }),
        checksum: "auto",
      },
    }).catch(() => {}); // non-blocking

    return NextResponse.json({
      success: true,
      message: `Reorder request logged for "${product.name}" (qty: ${reorderQty}). In production: triggers email/PO to supplier.`,
      product: { id: product.id, name: product.name, currentStock: product.stock },
    });
  } catch {
    return NextResponse.json({ error: "Failed to send reorder notification." }, { status: 500 });
  }
}
