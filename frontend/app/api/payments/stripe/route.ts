import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * POST /api/payments/stripe-webhook
 * Stripe 3D Secure / SCA webhook handler (G-029, G-031, G-048)
 * Handles: payment_intent.succeeded, payment_intent.payment_failed,
 *          charge.dispute.created, customer.subscription.deleted
 */

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_dummy", {
  apiVersion: "2026-03-25.dahlia",
});

export async function POST(req: Request) {
  const body      = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";
  const secret    = process.env.STRIPE_WEBHOOK_SECRET ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err: any) {
    console.error("[Stripe Webhook] Signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const { prisma } = await import("@/lib/prisma");

  try {
    switch (event.type) {
      // ── Payment successful (SCA/3DS passed) ───────────────────────────────
      case "payment_intent.succeeded": {
        const intent  = event.data.object as Stripe.PaymentIntent;
        const orderId = intent.metadata?.orderId ? parseInt(intent.metadata.orderId, 10) : null;
        if (orderId) {
          await prisma.order.update({ where: { id: orderId }, data: { status: "processing" } });
          console.info(`[Stripe] Order #${orderId} payment confirmed (3DS passed)`);
        }
        break;
      }

      // ── Payment failed (3DS failed or card declined) ───────────────────────
      case "payment_intent.payment_failed": {
        const intent  = event.data.object as Stripe.PaymentIntent;
        const orderId = intent.metadata?.orderId ? parseInt(intent.metadata.orderId, 10) : null;
        if (orderId) {
          await prisma.order.update({ where: { id: orderId }, data: { status: "cancelled" } });
          // Restore stock
          try {
            const order = await prisma.order.findUnique({
              where: { id: orderId },
              include: { items: true },
            });
            if (order && order.items) {
              for (const item of order.items) {
                await prisma.product.update({
                  where: { id: item.productId },
                  data: { stock: { increment: item.quantity } },
                });
              }
            }
          } catch (dbErr: any) {
            console.warn(`[Stripe] Failed to fetch order #${orderId} for stock restoration: ${dbErr.message}`);
          }
          console.warn(`[Stripe] Order #${orderId} payment failed — stock restored`);
        }
        break;
      }

      // ── Chargeback / Dispute created ───────────────────────────────────────
      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        await (prisma as any).auditLog.create({
          data: {
            action:   "CHARGEBACK_DISPUTE",
            resource: `Charge:${dispute.charge}`,
            userId:   "stripe",
            ip:       "stripe-webhook",
            payload:  JSON.stringify({ amount: dispute.amount, reason: dispute.reason }),
            checksum: "webhook",
          },
        }).catch(() => {});
        console.warn(`[Stripe] Dispute created: ${dispute.id}, amount: £${(dispute.amount / 100).toFixed(2)}`);
        break;
      }

      // ── Subscription cancelled ─────────────────────────────────────────────
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        console.info(`[Stripe] Subscription ${sub.id} cancelled`);
        break;
      }

      default:
        console.info(`[Stripe Webhook] Unhandled event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[Stripe Webhook] Handler error:", err.message);
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }
}

// ── Create Payment Intent (for 3DS checkout) ─────────────────────────────────
export async function PUT(req: Request) {
  try {
    const { amount, currency, orderId, customerEmail, metadata } = await req.json();
    if (!amount || !orderId) return NextResponse.json({ error: "amount and orderId required." }, { status: 400 });

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Stripe not configured. Set STRIPE_SECRET_KEY." }, { status: 503 });
    }

    const intent = await stripe.paymentIntents.create({
      amount:               Math.round(amount * 100), // pence
      currency:             currency ?? "gbp",
      receipt_email:        customerEmail,
      automatic_payment_methods: { enabled: true },
      metadata: {
        orderId:  String(orderId),
        platform: "groceryos",
        ...metadata,
      },
    });

    return NextResponse.json({
      clientSecret:    intent.client_secret,
      paymentIntentId: intent.id,
    });
  } catch (err: any) {
    return NextResponse.json({ error: `Stripe error: ${err.message}` }, { status: 500 });
  }
}
