import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * PayPal Checkout Integration (G-049)
 * Creates and captures PayPal orders via REST API
 */

const PAYPAL_BASE = process.env.PAYPAL_SANDBOX === "true"
  ? "https://api-m.sandbox.paypal.com"
  : "https://api-m.paypal.com";

async function getPayPalToken(): Promise<string> {
  const clientId     = process.env.PAYPAL_CLIENT_ID ?? "";
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET ?? "";

  if (!clientId || !clientSecret) throw new Error("PayPal credentials not configured.");

  const response = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method:  "POST",
    headers: {
      "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type":  "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await response.json();
  if (!data.access_token) throw new Error("Failed to get PayPal token");
  return data.access_token;
}

const CreateOrderSchema = z.object({
  amount:      z.number().positive(),
  currency:    z.string().length(3).default("GBP"),
  orderId:     z.number().int().positive(),
  description: z.string().max(200).default("GroceryOS Order"),
  returnUrl:   z.string().url().optional(),
  cancelUrl:   z.string().url().optional(),
});

// ── POST /api/payments/paypal — create PayPal order ──────────────────────────
export async function POST(req: Request) {
  try {
    const parsed = CreateOrderSchema.safeParse(await req.json());
    if (!parsed.success) { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }

    const { amount, currency, orderId, description, returnUrl, cancelUrl } = parsed.data;
    const token = await getPayPalToken();

    const response = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: `ORDER-${orderId}`,
          description,
          amount: {
            currency_code: currency.toUpperCase(),
            value:         amount.toFixed(2),
            breakdown: {
              item_total: { currency_code: currency.toUpperCase(), value: (amount / 1.2).toFixed(2) },
              tax_total:  { currency_code: currency.toUpperCase(), value: (amount - amount / 1.2).toFixed(2) },
            },
          },
        }],
        application_context: {
          brand_name:          "GroceryOS",
          shipping_preference: "SET_PROVIDED_ADDRESS",
          user_action:         "PAY_NOW",
          return_url: returnUrl ?? `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/success`,
          cancel_url: cancelUrl ?? `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/cancel`,
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: data.message ?? "PayPal order creation failed." }, { status: response.status });

    const approvalUrl = data.links?.find((l: any) => l.rel === "approve")?.href;
    return NextResponse.json({ paypalOrderId: data.id, approvalUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "PayPal integration unavailable." }, { status: 503 });
  }
}

// ── PUT /api/payments/paypal — capture PayPal payment ────────────────────────
export async function PUT(req: Request) {
  try {
    const { paypalOrderId, internalOrderId } = await req.json();
    if (!paypalOrderId) return NextResponse.json({ error: "paypalOrderId required." }, { status: 400 });

    const token    = await getPayPalToken();
    const response = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${paypalOrderId}/capture`, {
      method:  "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    });

    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: data.message ?? "Capture failed." }, { status: response.status });

    // Update internal order status
    if (internalOrderId) {
      const { prisma } = await import("@/lib/prisma");
      await prisma.order.update({ where: { id: internalOrderId }, data: { status: "processing" } });
    }

    return NextResponse.json({ success: true, captureId: data.purchase_units?.[0]?.payments?.captures?.[0]?.id, status: data.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "PayPal capture failed." }, { status: 503 });
  }
}
