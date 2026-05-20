import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Klarna / Buy Now Pay Later (G-051, G-124)
 * Uses Klarna Payments API to create sessions
 * Apple Pay / Google Pay via Stripe Payment Request Button (G-050)
 */

// ── POST /api/payments/klarna — create Klarna session ────────────────────────
const KlarnaSchema = z.object({
  amount:        z.number().positive(),
  currency:      z.string().length(3).default("GBP"),
  locale:        z.string().default("en-GB"),
  email:         z.string().email().optional(),
  orderId:       z.number().int().positive(),
  orderLines:    z.array(z.object({
    name:         z.string(),
    quantity:     z.number().int().positive(),
    unit_price:   z.number().int().positive(), // in pence/cents
    total_amount: z.number().int().positive(),
  })).optional(),
});

export async function POST(req: Request) {
  try {
    const parsed = KlarnaSchema.safeParse(await req.json());
    if (!parsed.success) { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }

    const { amount, currency, locale, email, orderId, orderLines } = parsed.data;

    const klarnaApiKey = process.env.KLARNA_API_KEY;
    if (!klarnaApiKey) {
      // Return mock session in dev (no credentials)
      return NextResponse.json({
        sessionId:     `kp_mock_${Date.now()}`,
        clientToken:   "klarna-mock-client-token",
        paymentMethods: ["pay_later", "pay_over_time", "pay_now"],
        message:       "Klarna mock session (set KLARNA_API_KEY for live)",
        expiresAt:     new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      });
    }

    const baseUrl = process.env.KLARNA_SANDBOX === "true"
      ? "https://api.playground.klarna.com"
      : "https://api.klarna.com";

    const response = await fetch(`${baseUrl}/payments/v1/sessions`, {
      method:  "POST",
      headers: {
        "Authorization": `Basic ${Buffer.from(klarnaApiKey).toString("base64")}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        purchase_country:  "GB",
        purchase_currency: currency.toUpperCase(),
        locale,
        order_amount:      Math.round(amount * 100),
        order_tax_amount:  Math.round((amount - amount / 1.2) * 100),
        order_lines:       orderLines ?? [{
          type:         "physical",
          name:         `GroceryOS Order #${orderId}`,
          quantity:     1,
          unit_price:   Math.round(amount * 100),
          total_amount: Math.round(amount * 100),
          tax_rate:     2000, // 20%
          total_tax_amount: Math.round((amount - amount / 1.2) * 100),
        }],
        customer: email ? { email } : undefined,
        merchant_reference1: `ORDER-${orderId}`,
      }),
    });

    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: data.error_messages?.[0] ?? "Klarna session failed." }, { status: response.status });

    return NextResponse.json({
      sessionId:    data.session_id,
      clientToken:  data.client_token,
      paymentMethods: data.payment_method_categories,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Klarna unavailable." }, { status: 503 });
  }
}

// ── GET /api/payments/klarna — Apple Pay / Google Pay eligibility check (G-050)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const amount   = parseFloat(searchParams.get("amount") ?? "0");
  const currency = searchParams.get("currency") ?? "GBP";

  return NextResponse.json({
    applePay: {
      supported: true, // Stripe Payment Request Button handles this
      note:      "Enabled via Stripe stripe.paymentRequest(). Requires HTTPS and registered domain.",
      setup:     "Add apple-developer-merchantid-domain-association file to /.well-known/",
    },
    googlePay: {
      supported: true,
      note:      "Enabled via Stripe Payment Request Button — no extra config needed.",
    },
    klarna: {
      supported:      true,
      paymentOptions: ["Pay in 3", "Pay Later (30 days)", "Pay Now"],
    },
    amount,
    currency,
  });
}
