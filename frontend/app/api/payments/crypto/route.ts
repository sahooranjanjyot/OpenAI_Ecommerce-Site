import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/auth-middleware";
import { z } from "zod";

/**
 * Crypto Payments (G-125) via Coinbase Commerce
 * Creates crypto payment charges for BTC, ETH, USDC, DOGE
 */

const CryptoChargeSchema = z.object({
  orderId:     z.number().int().positive(),
  amount:      z.number().positive(),
  currency:    z.string().length(3).default("GBP"),
  customerEmail: z.string().email().optional(),
  name:        z.string().optional().default("GroceryOS Order"),
});

// ── POST /api/payments/crypto — create Coinbase Commerce charge ───────────────
export async function POST(req: Request) {
  try {
    const parsed = CryptoChargeSchema.safeParse(await req.json());
    if (!parsed.success) { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }

    const { orderId, amount, currency, customerEmail, name } = parsed.data;
    const apiKey = process.env.COINBASE_COMMERCE_API_KEY;

    if (!apiKey) {
      // Mock response for dev
      return NextResponse.json({
        chargeId:    `mock_charge_${Date.now()}`,
        hostedUrl:   `https://commerce.coinbase.com/charges/mock`,
        expiresAt:   new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        cryptoPrices: {
          BTC:  "0.00089",
          ETH:  "0.012",
          USDC: amount.toFixed(2),
          DOGE: "8.23",
        },
        message:     "Coinbase Commerce mock (set COINBASE_COMMERCE_API_KEY for live)",
      });
    }

    const response = await fetch("https://api.commerce.coinbase.com/charges", {
      method:  "POST",
      headers: {
        "X-CC-Api-Key":   apiKey,
        "X-CC-Version":   "2018-03-22",
        "Content-Type":   "application/json",
      },
      body: JSON.stringify({
        name:        `${name} #${orderId}`,
        description: `GroceryOS Order #${orderId}`,
        local_price: { amount: amount.toFixed(2), currency: currency.toUpperCase() },
        pricing_type: "fixed_price",
        metadata: {
          order_id:       String(orderId),
          customer_email: customerEmail ?? "",
        },
        redirect_url:  `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/success?orderId=${orderId}`,
        cancel_url:    `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/cancel`,
      }),
    });

    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: data.error?.message ?? "Crypto charge creation failed." }, { status: response.status });

    return NextResponse.json({
      chargeId:  data.data.id,
      hostedUrl: data.data.hosted_url,
      expiresAt: data.data.expires_at,
      addresses: data.data.addresses,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Crypto payment unavailable." }, { status: 503 });
  }
}

// ── POST /api/payments/crypto/webhook — Coinbase Commerce webhook ─────────────
export async function PUT(req: Request) {
  try {
    const signature = req.headers.get("x-cc-webhook-signature") ?? "";
    const sharedSecret = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET ?? "";
    const body = await req.json();

    // Verify webhook signature (HMAC-SHA256)
    const { createHmac } = await import("crypto");
    const computed = createHmac("sha256", sharedSecret).update(JSON.stringify(body)).digest("hex");
    if (sharedSecret && computed !== signature) {
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
    }

    const { type, data } = body.event ?? {};
    const orderId = parseInt(data?.metadata?.order_id ?? "0", 10);
    const { prisma } = await import("../../../lib/prisma");

    switch (type) {
      case "charge:confirmed":
        if (orderId) await prisma.order.update({ where: { id: orderId }, data: { status: "processing" } });
        break;
      case "charge:failed":
        if (orderId) await prisma.order.update({ where: { id: orderId }, data: { status: "cancelled" } });
        break;
    }

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Webhook failed." }, { status: 500 });
  }
}
