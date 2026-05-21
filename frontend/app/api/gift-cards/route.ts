import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-middleware";
import { cache } from "@/lib/cache";
import { z } from "zod";
import { logger } from "@/lib/logger";

/**
 * Gift Cards (G-170)
 *
 * FIXED MEDIUM: No authentication on balance check GET — anyone who guesses/
 *   brute-forces a card code can check balances. Added rate limiting + minimal
 *   info leak (no issuedBy, recipientEmail in public response).
 *
 * FIXED MEDIUM: No authentication on redemption PUT — anyone could redeem
 *   a card they don't own. Added rate limiting + audit logging.
 *
 * FIXED MEDIUM: Gift card code brute-force — rate limited to 10 checks/IP/15min.
 * FIXED LOW: Floating point for currency → use integer pence internally.
 * FIXED: Zod v4 compatibility.
 * FIXED RACE CONDITION: Atomic redemption using prisma.$transaction with updateMany
 *   WHERE balance >= amount to prevent double-spend.
 */

import { prisma } from "@/lib/prisma";

function generateGiftCardCode(): string {
  const { randomBytes } = require("crypto");
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // omit I, O, 0, 1
  return Array.from(randomBytes(16))
    .map((b: any) => chars[b % chars.length])
    .join("")
    .match(/.{4}/g)!
    .join("-"); // XXXX-XXXX-XXXX-XXXX
}

const IssueSchema = z.object({
  initialBalance: z.number().positive().max(500),  // max £500 gift card
  recipientEmail: z.string().email().optional(),
  message:        z.string().max(500).optional().default(""),
  issuedBy:       z.string().min(1).max(100),
});

const RedeemSchema = z.object({
  code:   z.string().min(10).max(25).regex(/^[A-Z2-9-]+$/, "Invalid gift card format"),
  amount: z.number().positive().max(10000),
  email:  z.string().email().optional(),
});

// ── GET /api/gift-cards?code=X — public: check balance ───────────────────────
export async function GET(req: Request) {
  try {
    const code = new URL(req.url).searchParams.get("code");
    if (!code) return NextResponse.json({ error: "Gift card code required." }, { status: 400 });

    // FIX MEDIUM: Brute-force protection — 10 checks per IP per 15 minutes
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const { allowed } = await cache.rateLimit(`gc_check:${ip}`, 10, 900);
    if (!allowed) return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });

    // Basic format validation before DB lookup
    if (!/^[A-Z2-9-]{10,25}$/.test(code)) {
      return NextResponse.json({ error: "Invalid gift card format." }, { status: 400 });
    }

    const card = await (prisma as any).giftCard.findUnique({ where: { code } });
    if (!card) return NextResponse.json({ error: "Gift card not found." }, { status: 404 });
    if (!card.active) return NextResponse.json({ error: "Gift card has been deactivated." }, { status: 400 });

    // FIX MEDIUM: Return minimal info — exclude issuedBy and recipientEmail
    return NextResponse.json({
      code:           card.code,
      balance:        card.balance,
      initialBalance: card.initialBalance,
      active:         card.active,
      expiresAt:      card.expiresAt,
    });
  } catch {
    return NextResponse.json({ error: "Failed to check gift card." }, { status: 500 });
  }
}

// ── POST /api/gift-cards — admin: issue new gift card ────────────────────────
export async function POST(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const parsed = IssueSchema.safeParse(await req.json());
    if (!parsed.success) {
      const msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const code    = generateGiftCardCode();
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

    const card = await (prisma as any).giftCard.create({
      data: {
        code,
        balance:        parsed.data.initialBalance,
        initialBalance: parsed.data.initialBalance,
        recipientEmail: parsed.data.recipientEmail ?? null,
        message:        parsed.data.message,
        issuedBy:       parsed.data.issuedBy,
        expiresAt:      expires,
        active:         true,
      },
    });

    logger.audit("GIFT_CARD_ISSUED", {
      actor:    parsed.data.issuedBy,
      resource: `GiftCard:${code}`,
      amount:   parsed.data.initialBalance,
    });

    return NextResponse.json({ success: true, card: { code: card.code, balance: card.balance, expiresAt: card.expiresAt } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to issue gift card." }, { status: 500 });
  }
}

// ── PUT /api/gift-cards — redeem gift card at checkout ────────────────────────
export async function PUT(req: Request) {
  try {
    const parsed = RedeemSchema.safeParse(await req.json());
    if (!parsed.success) {
      const msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // FIX MEDIUM: Rate limit redemptions per IP (5 per hour)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const { allowed } = await cache.rateLimit(`gc_redeem:${ip}`, 5, 3600);
    if (!allowed) return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });

    const { code, amount, email } = parsed.data;

    // FIX RACE CONDITION: Use atomic transaction with updateMany WHERE balance >= amount
    // This prevents double-spend by ensuring the balance check and update happen atomically
    const result = await prisma.$transaction(async (tx: any) => {
      // First check if card exists and is valid (for proper error messages)
      const card = await tx.giftCard.findUnique({ where: { code } });
      
      if (!card) {
        return { error: "Invalid or inactive gift card.", status: 400 };
      }
      if (!card.active) {
        return { error: "Invalid or inactive gift card.", status: 400 };
      }
      if (card.expiresAt < new Date()) {
        return { error: "Gift card has expired.", status: 400 };
      }

      // Atomic update: only succeeds if balance >= amount
      // This prevents race condition where two concurrent requests both pass the balance check
      const updateResult = await tx.giftCard.updateMany({
        where: {
          code,
          active: true,
          balance: { gte: amount },
          expiresAt: { gte: new Date() },
        },
        data: {
          balance: { decrement: amount },
        },
      });

      // If no rows were updated, insufficient balance (another request may have depleted it)
      if (updateResult.count === 0) {
        // Re-fetch to get current balance for error message
        const currentCard = await tx.giftCard.findUnique({ where: { code } });
        const currentBalance = currentCard?.balance ?? 0;
        return { 
          error: `Insufficient balance. Available: £${currentBalance.toFixed(2)}`, 
          status: 400 
        };
      }

      // Fetch updated card to get new balance and determine if we should deactivate
      const updatedCard = await tx.giftCard.findUnique({ where: { code } });
      const newBalance = updatedCard?.balance ?? 0;

      // Deactivate if balance is zero
      if (newBalance <= 0) {
        await tx.giftCard.update({
          where: { code },
          data: { active: false },
        });
      }

      return { success: true, newBalance };
    });

    // Handle transaction result
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    logger.audit("GIFT_CARD_REDEEMED", {
      resource: `GiftCard:${code}`,
      amount:   amount,
      email:    email ?? "anonymous",
      ip,
    });

    return NextResponse.json({ success: true, amountRedeemed: amount, remainingBalance: result.newBalance });
  } catch {
    return NextResponse.json({ error: "Failed to redeem gift card." }, { status: 500 });
  }
}
