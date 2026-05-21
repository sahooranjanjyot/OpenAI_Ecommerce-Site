import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-middleware";

/**
 * Split Payment (G-120) — divide order payment across multiple methods
 * Supports: card + gift card | card + loyalty points | card + store credit
 */

const SplitPaymentSchema = z.object({
  orderId:  z.number().int().positive(),
  total:    z.number().positive(),
  customerId: z.number().int().positive().optional(), // Required for store_credit
  payments: z.array(z.object({
    method: z.enum(["card", "gift_card", "loyalty_points", "cash", "store_credit"]),
    amount: z.number().positive(),
    ref:    z.string().optional(), // gift card code or "loyalty" or "cash"
  })).min(1).max(4),
});

export async function POST(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  try {
    const parsed = SplitPaymentSchema.safeParse(await req.json());
    if (!parsed.success) { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }

    const { orderId, total, payments, customerId } = parsed.data;
    const { prisma } = await import("@/lib/prisma");

    // Validate total matches sum of payment amounts
    const paymentSum = payments.reduce((s, p) => s + p.amount, 0);
    if (Math.abs(paymentSum - total) > 0.01) {
      return NextResponse.json({
        error: `Payment sum (£${paymentSum.toFixed(2)}) doesn't match order total (£${total.toFixed(2)}).`
      }, { status: 400 });
    }

    const results: any[] = [];

    for (const payment of payments) {
      switch (payment.method) {
        case "gift_card": {
          if (!payment.ref) { results.push({ method: "gift_card", error: "Gift card code required." }); break; }
          const card = await (prisma as any).giftCard.findUnique({ where: { code: payment.ref.toUpperCase() } });
          if (!card || !card.active || card.balance < payment.amount) {
            results.push({ method: "gift_card", error: `Insufficient gift card balance (£${card?.balance?.toFixed(2) ?? 0} available).` });
          } else {
            await (prisma as any).giftCard.update({
              where: { code: payment.ref.toUpperCase() },
              data:  { balance: { decrement: payment.amount } },
            });
            results.push({ method: "gift_card", amount: payment.amount, status: "processed", ref: payment.ref });
          }
          break;
        }
        case "loyalty_points": {
          const pointsNeeded = Math.ceil(payment.amount * 100);
          results.push({ method: "loyalty_points", amount: payment.amount, pointsUsed: pointsNeeded, status: "process_via_loyalty_api", note: "Call POST /api/loyalty {action:redeem} to deduct points." });
          break;
        }
        case "cash": {
          results.push({ method: "cash", amount: payment.amount, status: "pending_physical_collection" });
          break;
        }
        case "card": {
          results.push({ method: "card", amount: payment.amount, status: "process_via_stripe", note: "Call POST /api/payments/stripe to create payment intent for this amount." });
          break;
        }
        case "store_credit": {
          if (!customerId) {
            results.push({ method: "store_credit", error: "Customer ID required for store credit redemption." });
            break;
          }
          const customer = await (prisma as any).customer.findUnique({ where: { id: customerId } });
          if (!customer) {
            results.push({ method: "store_credit", error: "Customer not found." });
            break;
          }
          const currentBalance = customer.storeCredit ?? 0;
          if (currentBalance < payment.amount) {
            results.push({ method: "store_credit", error: `Insufficient store credit balance (£${currentBalance.toFixed(2)} available).` });
          } else {
            await (prisma as any).customer.update({
              where: { id: customerId },
              data:  { storeCredit: { decrement: payment.amount } },
            });
            results.push({ method: "store_credit", amount: payment.amount, status: "processed", previousBalance: currentBalance, newBalance: currentBalance - payment.amount });
          }
          break;
        }
        default:
          results.push({ method: payment.method, status: "unknown_method" });
      }
    }

    const allOk = results.every(r => !r.error);
    if (allOk) {
      await prisma.order.update({ where: { id: orderId }, data: { status: "processing" } });
    }

    return NextResponse.json({ success: allOk, orderId, total, payments: results });
  } catch {
    return NextResponse.json({ error: "Split payment processing failed." }, { status: 500 });
  }
}
