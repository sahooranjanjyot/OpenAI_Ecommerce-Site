import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

// ── Stripe SCA / 3D Secure Payment Intent (G-029) ─────────────────────────────
// Creates a Stripe PaymentIntent for SCA-compliant checkout.
// The frontend uses the returned clientSecret with stripe.confirmCardPayment()
// which handles 3DS challenges automatically.
//
// Flow:
//   1. Frontend POSTs cart + buyer info here
//   2. Server verifies prices and stock, calculates total with VAT
//   3. Server creates Stripe PaymentIntent and returns clientSecret
//   4. Frontend calls stripe.confirmCardPayment(clientSecret, { card element })
//   5. Stripe handles 3DS challenge popup if bank requires it
//   6. On success, frontend POSTs to /api/checkout with paymentIntentId
//   7. /api/checkout verifies paymentIntentId with Stripe before creating order

const stripeKey = process.env.STRIPE_SECRET_KEY;

const UK_VAT_RATE = 0.20;

const CartItemSchema = z.object({
  id:    z.number().int().positive(),
  price: z.number().positive(),
  qty:   z.number().int().positive(),
});

const IntentSchema = z.object({
  buyer: z.object({
    name:   z.string().min(1).max(200),
    mobile: z.string().min(5).max(20),
  }),
  cart:            z.array(CartItemSchema).min(1),
  deliveryAddress: z.string().min(5).max(500),
  couponCode:      z.string().optional(),
});

export async function POST(req: Request) {
  try {
    if (!stripeKey) {
      return NextResponse.json(
        { error: "Payment processing not configured. Please set STRIPE_SECRET_KEY." },
        { status: 503 }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    const raw = await req.json();
    const parsed = IntentSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { buyer, cart, deliveryAddress, couponCode } = parsed.data;

    // ── Server-side price verification (prevent cart manipulation) ─────────
    const productIds = cart.map(i => i.id);
    const dbProducts = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(dbProducts.map(p => [p.id, p]));

    for (const item of cart) {
      const dbProduct = productMap.get(item.id);
      if (!dbProduct) {
        return NextResponse.json({ error: `Product not found: ${item.id}` }, { status: 400 });
      }
      if (!dbProduct.enabled) {
        return NextResponse.json({ error: `${dbProduct.name} is no longer available.` }, { status: 400 });
      }
      if (dbProduct.stock < item.qty) {
        return NextResponse.json(
          { error: `Insufficient stock for ${dbProduct.name}. Only ${dbProduct.stock} available.` },
          { status: 400 }
        );
      }
    }

    // ── Server-side total calculation (G-022 UK VAT) ───────────────────────
    let serverSubtotal = cart.reduce((sum, item) => {
      const product = productMap.get(item.id)!;
      return sum + (product.price * item.qty);
    }, 0);

    // Apply coupon if provided
    let discountAmount = 0;
    if (couponCode) {
      const coupon = await prisma.coupon.findFirst({
        where: { code: couponCode, active: true },
      });
      if (coupon && (!coupon.expiresAt || coupon.expiresAt > new Date())) {
        if (coupon.type === "percent") {
          discountAmount = Math.round(serverSubtotal * (coupon.value / 100));
        } else if (coupon.type === "fixed") {
          discountAmount = Math.min(coupon.value, serverSubtotal);
        }
        serverSubtotal -= discountAmount;
      }
    }

    const vatAmount    = Math.round(serverSubtotal * UK_VAT_RATE);
    const totalPennies = serverSubtotal + vatAmount; // Stripe expects pence (integer)

    if (totalPennies < 30) {
      return NextResponse.json({ error: "Order total too low for card payment." }, { status: 400 });
    }

    // ── Create Stripe PaymentIntent ────────────────────────────────────────
    const paymentIntent = await stripe.paymentIntents.create({
      amount:   totalPennies,
      currency: "gbp",
      automatic_payment_methods: { enabled: true },
      metadata: {
        buyerName:       buyer.name,
        buyerPhone:      buyer.mobile,
        deliveryAddress: deliveryAddress.substring(0, 500),
        itemCount:       String(cart.length),
        couponCode:      couponCode ?? "",
      },
      description: `GroceryOS Order — ${buyer.name}`,
    });

    return NextResponse.json({
      clientSecret:    paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amountPennies:   totalPennies,
      vatBreakdown: {
        subtotal:     (serverSubtotal / 100).toFixed(2),
        vatAmount:    (vatAmount / 100).toFixed(2),
        total:        (totalPennies / 100).toFixed(2),
        discountSaved: (discountAmount / 100).toFixed(2),
      },
    });

  } catch (err: any) {
    console.error("[PAYMENT INTENT ERROR]", err.message);
    // Don't expose Stripe error details to client
    if (err.type?.startsWith("Stripe")) {
      return NextResponse.json({ error: "Payment gateway error. Please try again." }, { status: 502 });
    }
    return NextResponse.json({ error: "Failed to create payment session." }, { status: 500 });
  }
}
