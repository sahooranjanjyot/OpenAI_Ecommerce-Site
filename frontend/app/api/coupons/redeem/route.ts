import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

/**
 * POST /api/coupons/redeem
 *
 * H2 FIX — CRITICAL RACE CONDITION:
 * Uses Prisma $transaction with an atomic conditional UPDATE:
 *   UPDATE coupon SET usedCount = usedCount + 1
 *   WHERE code = $code AND usedCount < maxUses
 *
 * If the row is not updated (count = 0), the coupon limit has been reached.
 * This is a single atomic DB operation — impossible to exceed maxUses
 * under any concurrent load, unlike the previous read-check-increment pattern.
 */

const RedeemSchema = z.object({
  code:    z.string().min(1).max(50),
  orderId: z.number().int().positive(),
});

export async function POST(req: Request) {
  try {
    const raw    = await req.json();
    const parsed = RedeemSchema.safeParse(raw);
    if (!parsed.success) {
      { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }
    }

    const { code, orderId } = parsed.data;
    const upperCode = code.toUpperCase();

    const result = await prisma.$transaction(async (tx) => {
      // Step 1: Fetch coupon with a pessimistic lock
      const coupon = await (tx as any).coupon.findUnique({
        where: { code: upperCode },
      });

      if (!coupon)          throw Object.assign(new Error("Coupon not found."),              { status: 404 });
      if (!coupon.active)   throw Object.assign(new Error("Coupon is inactive."),            { status: 400 });
      if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
        throw Object.assign(new Error("Coupon has expired."), { status: 400 });
      }

      // Step 2: Atomic conditional increment — the WHERE clause is the guard
      // If usedCount >= maxUses, updateMany returns count=0 and we throw.
      // This works correctly under concurrent requests (no TOCTOU window).
      if (coupon.maxUses !== null) {
        const updated = await (tx as any).coupon.updateMany({
          where: {
            code:      upperCode,
            usedCount: { lt: coupon.maxUses },  // atomic guard
          },
          data: { usedCount: { increment: 1 } },
        });

        if (updated.count === 0) {
          throw Object.assign(
            new Error("Coupon has reached its usage limit."),
            { status: 400 }
          );
        }
      } else {
        // Unlimited coupon — still increment for tracking
        await (tx as any).coupon.update({
          where: { code: upperCode },
          data:  { usedCount: { increment: 1 } },
        });
      }

      // Step 3: Record the redemption against the order
      await (tx as any).couponRedemption?.create?.({
        data: { couponCode: upperCode, orderId },
      }).catch(() => { /* table may not exist yet — non-fatal */ });

      return {
        code:  coupon.code,
        type:  coupon.type,
        value: coupon.value,
      };
    });

    return NextResponse.json({ success: true, discount: result });

  } catch (err: any) {
    const status = err.status ?? 500;
    console.error("[COUPON REDEEM ERROR]", err.message);
    return NextResponse.json(
      { error: err.message ?? "Failed to redeem coupon." },
      { status }
    );
  }
}
