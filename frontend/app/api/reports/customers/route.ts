import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/auth-middleware";
import { z } from "zod";

/**
 * GET /api/reports/customers
 * Customer analytics — CLV, cohorts, retention (G-073, G-129, G-043) — admin only
 */
export async function GET(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  try {
    const { prisma } = await import("../../../lib/prisma");

    const [customers, orders] = await Promise.all([
      prisma.customer.findMany({
        select: { id: true, name: true, orders: true, createdAt: true, blocked: true },
        orderBy: { orders: "desc" },
      }),
      prisma.order.findMany({
        select: { customerId: true, total: true, status: true, createdAt: true },
      }),
    ]);

    // CLV per customer
    const revenueByCustomer: Record<number, number> = {};
    for (const o of orders) {
      if (!revenueByCustomer[o.customerId]) revenueByCustomer[o.customerId] = 0;
      revenueByCustomer[o.customerId] = parseFloat((revenueByCustomer[o.customerId] + o.total).toFixed(2));
    }

    const customerData = customers.map(c => ({
      id:           c.id,
      name:         c.name,
      totalOrders:  c.orders,
      totalRevenue: revenueByCustomer[c.id] ?? 0,
      avgOrderValue: c.orders > 0 ? parseFloat(((revenueByCustomer[c.id] ?? 0) / c.orders).toFixed(2)) : 0,
      segment:      c.orders >= 10 ? "champion" : c.orders >= 5 ? "loyal" : c.orders >= 2 ? "returning" : "new",
      blocked:      c.blocked,
      memberSince:  c.createdAt,
    }));

    // Segment summary
    const segments = { champion: 0, loyal: 0, returning: 0, new: 0 };
    for (const c of customerData) segments[c.segment as keyof typeof segments]++;

    const totalRevenue = Object.values(revenueByCustomer).reduce((a, b) => a + b, 0);
    const avgCLV       = customers.length > 0 ? parseFloat((totalRevenue / customers.length).toFixed(2)) : 0;

    return NextResponse.json({
      summary: {
        totalCustomers: customers.length,
        avgCLV,
        segments,
        blockedCount: customers.filter(c => c.blocked).length,
      },
      customers: customerData.slice(0, 100), // top 100
    });
  } catch {
    return NextResponse.json({ error: "Failed to generate customer report." }, { status: 500 });
  }
}
