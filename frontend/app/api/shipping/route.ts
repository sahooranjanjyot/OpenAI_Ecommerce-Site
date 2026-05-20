import { NextResponse } from "next/server";
import { z } from "zod";

// ── UK Shipping Rate Calculator (G-027, G-028) ────────────────────────────────
// Supports: flat rate, weight-based, and free shipping threshold

const SHIPPING_RULES = {
  FREE_THRESHOLD:    30.00,  // Free shipping over £30
  STANDARD_RATE:     3.99,   // Standard delivery
  EXPRESS_RATE:      7.99,   // Next-day delivery
  WEIGHT_RATE_KG:    0.50,   // Additional £0.50 per kg over 5kg
  BASE_WEIGHT_LIMIT: 5,      // Free weight allowance (kg)
};

const ShippingSchema = z.object({
  subtotal:     z.number().min(0),
  totalWeightKg: z.number().min(0).optional().default(0),
  postcode:     z.string().min(2).max(10).optional(),
  method:       z.enum(["standard", "express", "click_collect"]).optional().default("standard"),
});

export async function POST(req: Request) {
  try {
    const parsed = ShippingSchema.safeParse(await req.json());
    if (!parsed.success) { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }

    const { subtotal, totalWeightKg, method } = parsed.data;

    let shippingCost = 0;
    let freeShipping = false;
    let reason       = "";

    if (method === "click_collect") {
      shippingCost = 0;
      reason       = "Free Click & Collect from store";
    } else if (subtotal >= SHIPPING_RULES.FREE_THRESHOLD) {
      shippingCost = 0;
      freeShipping = true;
      reason       = `Free delivery on orders over £${SHIPPING_RULES.FREE_THRESHOLD.toFixed(2)}`;
    } else {
      const baseRate    = method === "express" ? SHIPPING_RULES.EXPRESS_RATE : SHIPPING_RULES.STANDARD_RATE;
      const weightExtra = totalWeightKg > SHIPPING_RULES.BASE_WEIGHT_LIMIT
        ? (totalWeightKg - SHIPPING_RULES.BASE_WEIGHT_LIMIT) * SHIPPING_RULES.WEIGHT_RATE_KG
        : 0;
      shippingCost = parseFloat((baseRate + weightExtra).toFixed(2));
      reason       = method === "express" ? "Next-day delivery" : "Standard UK delivery (2–3 days)";
    }

    const amountUntilFree = subtotal < SHIPPING_RULES.FREE_THRESHOLD
      ? parseFloat((SHIPPING_RULES.FREE_THRESHOLD - subtotal).toFixed(2))
      : 0;

    return NextResponse.json({
      method,
      shippingCost,
      freeShipping,
      reason,
      amountUntilFree,
      options: [
        { id: "standard",      label: "Standard (2–3 days)", cost: subtotal >= SHIPPING_RULES.FREE_THRESHOLD ? 0 : SHIPPING_RULES.STANDARD_RATE },
        { id: "express",       label: "Express (next day)",  cost: subtotal >= SHIPPING_RULES.FREE_THRESHOLD ? 0 : SHIPPING_RULES.EXPRESS_RATE },
        { id: "click_collect", label: "Click & Collect",     cost: 0 },
      ],
    });
  } catch {
    return NextResponse.json({ error: "Failed to calculate shipping." }, { status: 500 });
  }
}
