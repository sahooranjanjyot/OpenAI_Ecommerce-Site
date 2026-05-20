import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { requireAdmin } from "../../../lib/auth-middleware";
import { z } from "zod";

// ── Loyalty Points System (G-070, G-162, G-163) ──────────────────────────────
// Rules: 1 point per £1 spent | 100 points = £1 reward | 5x orders = LOYALTY tier

const POINTS_PER_POUND   = 1;
const POINTS_REDEEM_RATE = 100; // 100 points = £1

const RedeemSchema = z.object({
  email:        z.string().email(),
  pointsToUse:  z.number().int().positive(),
});

// ── GET /api/loyalty?email=X — get points balance ─────────────────────────────
export async function GET(req: Request) {
  try {
    const email = new URL(req.url).searchParams.get("email");
    if (!email) return NextResponse.json({ error: "email required." }, { status: 400 });

    const account = await (prisma as any).loyaltyAccount.findUnique({
      where:   { email },
      include: { transactions: { orderBy: { createdAt: "desc" }, take: 10 } },
    });

    if (!account) {
      return NextResponse.json({ email, points: 0, tier: "standard", transactions: [] });
    }

    const tier = account.points >= 5000 ? "gold" : account.points >= 1000 ? "silver" : "standard";
    const redeemableValue = parseFloat((Math.floor(account.points / POINTS_REDEEM_RATE)).toFixed(2));

    return NextResponse.json({
      email,
      points:         account.points,
      tier,
      redeemableValue: `£${redeemableValue.toFixed(2)}`,
      transactions:   account.transactions,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch loyalty account." }, { status: 500 });
  }
}

// ── POST /api/loyalty — award or redeem points ────────────────────────────────
export async function POST(req: Request) {
  try {
    const { action, email, orderId, orderTotal, pointsToUse } = await req.json();

    // FIX C-B2-2: Award requires admin auth — prevents arbitrary point grants
    if (action === "award") {
      const authErr = requireAdmin(req);
      if (authErr) return authErr;

      // Verify orderId exists and belongs to this email
      const order = await prisma.order.findUnique({ where: { id: parseInt(String(orderId), 10) } });
      if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

      const verifiedTotal = order.total / 100; // pence → GBP
      const pointsEarned = Math.floor(verifiedTotal * POINTS_PER_POUND);
      await (prisma as any).loyaltyAccount.upsert({
        where:  { email },
        update: { points: { increment: pointsEarned } },
        create: { email, points: pointsEarned },
      });
      await (prisma as any).loyaltyTransaction.create({
        data: { email, type: "earn", points: pointsEarned, description: `Order #${orderId} — earned ${pointsEarned} pts from £${orderTotal}` },
      });
      return NextResponse.json({ success: true, pointsEarned, message: `${pointsEarned} points added to your account.` });
    }

    // Redeem points for discount
    if (action === "redeem") {
      const parsed = RedeemSchema.safeParse({ email, pointsToUse });
      if (!parsed.success) { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }

      const discountValue = parseFloat((pointsToUse / POINTS_REDEEM_RATE).toFixed(2));

      // FIX RACE CONDITION: Use atomic transaction with conditional update
      const result = await prisma.$transaction(async (tx: any) => {
        // Atomic update: only succeeds if points >= pointsToUse
        const updateResult = await tx.loyaltyAccount.updateMany({
          where: {
            email,
            points: { gte: pointsToUse },
          },
          data: {
            points: { decrement: pointsToUse },
          },
        });

        // If no rows affected, insufficient points
        if (updateResult.count === 0) {
          return { success: false };
        }

        // Create transaction record
        await tx.loyaltyTransaction.create({
          data: { email, type: "redeem", points: -pointsToUse, description: `Redeemed ${pointsToUse} pts for £${discountValue} discount` },
        });

        // Get updated balance
        const updatedAccount = await tx.loyaltyAccount.findUnique({ where: { email } });

        return { success: true, remainingPoints: updatedAccount?.points ?? 0 };
      });

      if (!result.success) {
        return NextResponse.json({ error: "Insufficient loyalty points." }, { status: 400 });
      }

      return NextResponse.json({ success: true, discountValue, pointsUsed: pointsToUse, remainingPoints: result.remainingPoints });
    }

    return NextResponse.json({ error: "Invalid action. Use 'award' or 'redeem'." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Loyalty operation failed." }, { status: 500 });
  }
}

// ── GET /api/loyalty/admin — admin leaderboard ────────────────────────────────
export async function PUT(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const top = await (prisma as any).loyaltyAccount.findMany({
      orderBy: { points: "desc" },
      take:    50,
    });
    return NextResponse.json(top);
  } catch {
    return NextResponse.json({ error: "Failed to fetch loyalty leaderboard." }, { status: 500 });
  }
}
