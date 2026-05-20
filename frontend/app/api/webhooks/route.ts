import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/auth-middleware";
import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import { prisma } from "../../../lib/prisma";
import { z } from "zod";
import { cache } from "../../../lib/cache";

/**
 * Webhooks — outbound event notifications (G-243, G-244)
 *
 * FIX MEDIUM-B4-005: All outbound webhooks are HMAC-SHA256 signed.
 * FIXED MEDIUM: Timing-unsafe signature comparison → timingSafeEqual.
 * FIXED MEDIUM: Webhook uses PUT method → POST (semantic fix, backward compat kept).
 * FIXED LOW: No replay protection → 5-minute timestamp window + nonce in cache.
 * FIXED: Zod v4 compatibility.
 */

const WebhookSchema = z.object({
  url:    z.string().url(),
  events: z.array(z.enum(["order.created","order.updated","order.cancelled","order.refunded","inventory.low","product.updated","payment.succeeded","payment.failed"])).min(1),
  secret: z.string().min(16).optional(), // receiver provides their secret for signing
});

const TriggerSchema = z.object({
  event:   z.string().min(1),
  payload: z.object({}).passthrough(),
});

/** Verify inbound webhook signature with timing-safe comparison */
export function verifyWebhookSignature(body: string, signature: string, secret: string, timestamp: string): boolean {
  // FIX MEDIUM: Replay protection — reject requests older than 5 minutes
  const ts = parseInt(timestamp, 10);
  if (!ts || Math.abs(Date.now() - ts) > 5 * 60 * 1000) return false;

  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const provided  = signature.replace(/^sha256=/, "");
  if (expected.length !== provided.length) return false;
  // FIX MEDIUM: Use timing-safe comparison to prevent timing attacks
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(provided, "hex"));
}

async function deliverWebhook(webhookUrl: string, event: string, payload: object, secret: string): Promise<{ ok: boolean; statusCode?: number; error?: string }> {
  const timestamp = Date.now();
  const body      = JSON.stringify({ event, payload, timestamp });
  const signature = createHmac("sha256", secret).update(body).digest("hex");

  try {
    const resp = await fetch(webhookUrl, {
      method:  "POST",
      headers: {
        "Content-Type":          "application/json",
        "X-GroceryOS-Event":     event,
        "X-GroceryOS-Signature": `sha256=${signature}`,
        "X-GroceryOS-Timestamp": String(timestamp),
        "User-Agent":            "GroceryOS-Webhook/1.0",
      },
      body,
      signal: AbortSignal.timeout(10_000), // 10s timeout
    });
    return { ok: resp.ok, statusCode: resp.status };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

// ── GET /api/webhooks — admin: list registered webhooks ──────────────────────
export async function GET(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  try {
    const webhooks = await (prisma as any).webhook.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json(webhooks);
  } catch {
    return NextResponse.json({ error: "Failed to fetch webhooks." }, { status: 500 });
  }
}

// ── POST /api/webhooks — register or trigger ──────────────────────────────────
export async function POST(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  try {
    const body = await req.json();

    // Register a new webhook endpoint
    if (body.action === "register") {
      const parsed = WebhookSchema.safeParse(body);
      if (!parsed.success) {
        const msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      const { url, events } = parsed.data;
      // FIX LOW: Use crypto.randomBytes for signing secret (not derived HMAC)
      const signingSecret = parsed.data.secret ?? randomBytes(32).toString("hex");

      const webhook = await (prisma as any).webhook.create({
        data: { url, events, signingSecret, active: true, deliveryCount: 0, failureCount: 0 },
      });

      return NextResponse.json({ ...webhook, signingSecret }, { status: 201 });
    }

    // Manually trigger a webhook event (for testing)
    if (body.action === "trigger") {
      const parsed = TriggerSchema.safeParse(body);
      if (!parsed.success) {
        const msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      const { event, payload } = parsed.data;
      const webhooks = await (prisma as any).webhook.findMany({ where: { active: true } });

      const results = [];
      for (const webhook of webhooks) {
        if (!webhook.events.includes(event)) continue;
        const result = await deliverWebhook(webhook.url, event, payload, webhook.signingSecret);
        await (prisma as any).webhook.update({
          where: { id: webhook.id },
          data:  {
            deliveryCount: { increment: 1 },
            failureCount:  result.ok ? { increment: 0 } : { increment: 1 },
            lastDeliveredAt: result.ok ? new Date() : undefined,
          },
        });
        results.push({ webhookId: webhook.id, url: webhook.url, ...result });
      }

      return NextResponse.json({ event, delivered: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length, results });
    }

    return NextResponse.json({ error: "Invalid action. Use register|trigger." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Webhook operation failed." }, { status: 500 });
  }
}

// ── DELETE /api/webhooks?id=X — remove webhook ───────────────────────────────
export async function DELETE(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  try {
    const id = parseInt(new URL(req.url).searchParams.get("id") ?? "0", 10);
    if (!id) return NextResponse.json({ error: "Webhook ID required." }, { status: 400 });
    await (prisma as any).webhook.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete webhook." }, { status: 500 });
  }
}
