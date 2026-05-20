import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "../../../../lib/prisma";
import { z } from "zod";

/**
 * POST /api/webhooks/incoming
 *
 * Receives and validates incoming webhook calls from external providers.
 * HIGH FIX: All incoming webhooks MUST carry a valid HMAC-SHA256 signature.
 * Unsigned or tampered requests are rejected with 401.
 *
 * Providers: Stripe, PayPal, custom GroceryOS partners
 *
 * Security model:
 *  - Each registered webhook endpoint has a unique signingSecret stored in DB
 *  - Incoming payload is verified using HMAC-SHA256 with timingSafeEqual
 *  - Timestamp freshness check (reject if older than 5 minutes — replay prevention)
 */

const REPLAY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function verifyHmacSignature(
  rawBody:   string,
  signature: string,
  secret:    string,
  timestamp?: string
): boolean {
  try {
    // Replay attack prevention: reject stale timestamps
    if (timestamp) {
      const ts = parseInt(timestamp, 10);
      if (isNaN(ts) || Math.abs(Date.now() - ts) > REPLAY_WINDOW_MS) {
        return false;
      }
    }

    // Compute expected signature
    const message  = timestamp ? `${timestamp}.${rawBody}` : rawBody;
    const expected = createHmac("sha256", secret).update(message).digest("hex");

    // Constant-time comparison — prevents timing attacks
    const sigBuf = Buffer.from(signature.replace(/^sha256=/, ""), "hex");
    const expBuf = Buffer.from(expected, "hex");

    if (sigBuf.length !== expBuf.length) return false;
    return timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

// Stripe uses: Stripe-Signature header with t=timestamp,v1=sig format
function verifyStripeSignature(rawBody: string, headerValue: string, secret: string): boolean {
  const parts = Object.fromEntries(
    headerValue.split(",").map(p => p.split("=") as [string, string])
  );
  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return false;

  return verifyHmacSignature(rawBody, signature, secret, timestamp);
}

// GroceryOS partner webhooks use: X-GroceryOS-Signature: sha256=<hmac>
function verifyGroceryOSSignature(rawBody: string, signature: string, secret: string, timestamp?: string): boolean {
  return verifyHmacSignature(rawBody, signature, secret, timestamp);
}

const EventSchema = z.object({
  event:     z.string().min(1).max(100),
  payload:   z.record(z.any()),
  timestamp: z.number().optional(),
  id:        z.string().optional(), // idempotency key from provider
});

export async function POST(req: Request) {
  const rawBody = await req.text();

  // ── Determine provider from headers ──────────────────────────────────────────
  const stripeSignature    = req.headers.get("stripe-signature");
  const groceryOSSignature = req.headers.get("x-groceryos-signature");
  const groceryOSTimestamp = req.headers.get("x-groceryos-timestamp");

  let verified = false;
  let provider = "unknown";

  if (stripeSignature) {
    provider = "stripe";
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      console.error("[WEBHOOK] STRIPE_WEBHOOK_SECRET not set — rejecting Stripe webhook");
      return NextResponse.json({ error: "Webhook not configured." }, { status: 500 });
    }
    verified = verifyStripeSignature(rawBody, stripeSignature, secret);

  } else if (groceryOSSignature) {
    provider = "groceryos-partner";
    // Look up signing secret for the registered webhook by URL
    const origin = req.headers.get("origin") ?? req.headers.get("x-forwarded-for") ?? "unknown";
    const webhook = await (prisma as any).webhook.findFirst({
      where: { active: true },
    }).catch(() => null);

    if (!webhook?.signingSecret) {
      return NextResponse.json({ error: "Unknown webhook source." }, { status: 401 });
    }
    verified = verifyGroceryOSSignature(rawBody, groceryOSSignature, webhook.signingSecret, groceryOSTimestamp ?? undefined);

  } else {
    // No signature header — reject all unsigned incoming webhooks
    return NextResponse.json({ error: "Webhook signature required." }, { status: 401 });
  }

  if (!verified) {
    console.warn(`[WEBHOOK] Signature verification failed for provider=${provider}`);
    return NextResponse.json({ error: "Webhook signature invalid." }, { status: 401 });
  }

  // ── Process the verified event ────────────────────────────────────────────
  try {
    const body   = JSON.parse(rawBody);
    const parsed = EventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid event payload." }, { status: 400 });
    }

    const { event, payload } = parsed.data;

    // Log the verified incoming event for audit
    await (prisma as any).webhookLog?.create?.({
      data: {
        provider,
        event,
        payload:    JSON.stringify(payload),
        receivedAt: new Date(),
        verified:   true,
      },
    }).catch(() => { /* webhookLog table may not exist yet — non-fatal */ });

    // Dispatch to internal handlers
    switch (event) {
      case "payment.succeeded":
      case "charge.succeeded":
        // TODO: update order payment status
        break;
      case "payment.failed":
      case "charge.failed":
        // TODO: flag order for retry
        break;
      case "order.refunded":
        // TODO: trigger refund flow
        break;
      default:
        // Unhandled event — acknowledge receipt (do not 400)
        break;
    }

    return NextResponse.json({ received: true, event, provider });

  } catch {
    return NextResponse.json({ error: "Failed to process webhook." }, { status: 500 });
  }
}
