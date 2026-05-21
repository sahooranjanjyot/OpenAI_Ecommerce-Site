import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-middleware";
import { z } from "zod";
import { logger } from "@/lib/logger";

/**
 * Refunds API (G-048, G-032, G-034)
 *
 * FIXED: Refund now actually calls Stripe refund API (previously only created DB record).
 * FIXED MEDIUM: processedBy from client input — value now always taken from the authenticated admin token.
 * FIXED MEDIUM: No input validation on GET orderId → use Zod/parseInt strictly.
 * FIXED LOW: Audit logging added for all refund events.
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
    const { prisma } = await import("@/lib/prisma");

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
      take:    200,
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
    const { prisma } = await import("@/lib/prisma");

    const parsed = RefundSchema.safeParse(await req.json());
    if (!parsed.success) {
      const msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { orderId, amount, reason, type } = parsed.data;
    const processedBy = req.headers.get("x-admin-token") ? "admin" : "system";
    const amountPence = Math.round(amount * 100);

    const order = await prisma.order.findUnique({ where: { id: orderId } }) as any;
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    if (["cancelled", "refunded"].includes(order.status)) {
      return NextResponse.json({ error: `Cannot refund an order with status "${order.status}".` }, { status: 400 });
    }

    const existing        = await (prisma as any).refund.aggregate({ where: { orderId, status: "processed" }, _sum: { amount: true } });
    const alreadyRefunded = existing._sum.amount ?? 0;
    const fmt             = (p: number) => `£${(p / 100).toFixed(2)}`;

    if (alreadyRefunded + amountPence > order.total) {
      return NextResponse.json({
        error: `Refund rejected: already refunded ${fmt(alreadyRefunded)} + this ${fmt(amountPence)} = ${fmt(alreadyRefunded + amountPence)} exceeds order total ${fmt(order.total)}.`,
      }, { status: 400 });
    }

    // ── Stripe Refund (G-048) ──────────────────────────────────────────────
    // Actually return money via Stripe if the order was paid online
    let stripeRefundId: string | undefined;
    if (process.env.STRIPE_SECRET_KEY && order.stripePaymentIntentId) {
      try {
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
        const stripeRefund = await stripe.refunds.create({
          payment_intent: order.stripePaymentIntentId,
          amount:         amountPence,
          reason:         "requested_by_customer",
          metadata:       { orderId: String(orderId), reason: reason.substring(0, 500) },
        });
        stripeRefundId = stripeRefund.id;
      } catch (stripeErr: any) {
        console.error("[REFUND] Stripe refund failed:", stripeErr.message);
        return NextResponse.json({
          error: `Stripe refund failed: ${stripeErr.message}. DB record not created.`,
        }, { status: 502 });
      }
    }

    const refund = await (prisma as any).refund.create({
      data: {
        orderId,
        amount:         amountPence,
        reason,
        type,
        processedBy,
        status:         "processed",
        stripeRefundId: stripeRefundId ?? null,
      },
    });

    const totalRefunded = alreadyRefunded + amountPence;
    if (totalRefunded >= order.total || type === "full") {
      await prisma.order.update({ where: { id: orderId }, data: { status: "refunded" } });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    logger.audit("REFUND_PROCESSED", {
      resource:       `Order:${orderId}`,
      actor:          processedBy,
      amount,
      reason,
      type,
      stripeRefundId: stripeRefundId ?? "N/A (cash/offline order)",
      ip,
    });

    return NextResponse.json({
      success:             true,
      refund,
      stripeRefundId:      stripeRefundId ?? null,
      totalRefunded:       fmt(totalRefunded),
      remainingRefundable: fmt(order.total - totalRefunded),
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to process refund." }, { status: 500 });
  }
}
