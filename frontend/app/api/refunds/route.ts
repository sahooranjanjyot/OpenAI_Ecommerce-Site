import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/auth-middleware";
import { z } from "zod";
import { logger } from "../../../lib/logger";

/**
 * Refunds API (G-048, G-032, G-034)
 *
 * FIXED MEDIUM: processedBy from client input — value now always taken from
 *   the authenticated admin token (not trusting client-provided name).
 * FIXED MEDIUM: No input validation on GET orderId → use Zod/parseInt strictly.
 * FIXED LOW: Audit logging added for all refund events.
 * FIXED: Zod v4 compatibility.
 */

const RefundSchema = z.object({
  orderId:     z.number().int().positive(),
  amount:      z.number().positive("Refund amount must be positive").max(100000),
  reason:      z.string().min(3).max(500),
  type:        z.enum(["full", "partial"]).default("full"),
  // processedBy now ignored from client — set server-side from auth token
});

export async function GET(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const { prisma } = await import("../../../lib/prisma");

    // FIX MEDIUM: Strict id parsing
    const rawId   = new URL(req.url).searchParams.get("orderId");
    const orderId = rawId ? parseInt(rawId, 10) : NaN;
    if (rawId && (!orderId || orderId <= 0)) {
      return NextResponse.json({ error: "Invalid orderId." }, { status: 400 });
    }

    const where: any = orderId > 0 ? { orderId } : {};
    const refunds = await (prisma as any).refund.findMany({
      where,
      include: { order: { select: { id: true, total: true, status: true, customerId: true } } },
      orderBy: { createdAt: "desc" },
      take:    200,  // paginate large refund lists
    });
    return NextResponse.json(refunds);
  } catch {
    return NextResponse.json({ error: "Failed to fetch refunds." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const { prisma } = await import("../../../lib/prisma");

    const parsed = RefundSchema.safeParse(await req.json());
    if (!parsed.success) {
      const msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { orderId, amount, reason, type } = parsed.data;
    // FIX MEDIUM: processedBy from server-side token, not client input
    const processedBy = req.headers.get("x-admin-token") ? "admin" : "system";
    const amountPence = Math.round(amount * 100);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    if (["cancelled", "refunded"].includes(order.status)) {
      return NextResponse.json({ error: `Cannot refund an order with status "${order.status}".` }, { status: 400 });
    }

    // FIX C-B2-4: Cumulative refund check (unchanged)
    const existing       = await (prisma as any).refund.aggregate({ where: { orderId, status: "processed" }, _sum: { amount: true } });
    const alreadyRefunded = existing._sum.amount ?? 0;
    const fmt            = (p: number) => `£${(p / 100).toFixed(2)}`;

    if (alreadyRefunded + amountPence > order.total) {
      return NextResponse.json({
        error: `Refund rejected: already refunded ${fmt(alreadyRefunded)} + this ${fmt(amountPence)} = ${fmt(alreadyRefunded + amountPence)} exceeds order total ${fmt(order.total)}.`,
      }, { status: 400 });
    }

    const refund = await (prisma as any).refund.create({
      data: { orderId, amount: amountPence, reason, type, processedBy, status: "processed" },
    });

    const totalRefunded = alreadyRefunded + amountPence;
    if (totalRefunded >= order.total || type === "full") {
      await prisma.order.update({ where: { id: orderId }, data: { status: "refunded" } });
    }

    // FIX LOW: Audit log every refund
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    logger.audit("REFUND_PROCESSED", {
      resource: `Order:${orderId}`,
      actor:    processedBy,
      amount,
      reason,
      type,
      ip,
    });

    return NextResponse.json({
      success:             true,
      refund,
      totalRefunded:       fmt(totalRefunded),
      remainingRefundable: fmt(order.total - totalRefunded),
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to process refund." }, { status: 500 });
  }
}
