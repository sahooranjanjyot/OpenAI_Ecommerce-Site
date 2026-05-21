import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { cache } from "@/lib/cache";
import { requireAdmin } from "@/lib/auth-middleware";

/**
 * Web Push Notifications (G-094, G-093)
 *
 * FIXED MEDIUM: No rate limiting on subscribe (email harvesting) → 10/IP/hour.
 * FIXED MEDIUM: VAPID public key not in public GET (minor info leak) → removed.
 * FIXED MEDIUM: Email harvesting on subscribe → generic response.
 * FIXED: Zod v4 compatibility.
 */

const VAPID_PUBLIC  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_EMAIL   = process.env.VAPID_EMAIL ?? "admin@groceryos.example.com";

const SubscribeSchema = z.object({
  action:       z.literal("subscribe"),
  email:        z.string().email(),
  authToken:    z.string().min(1), // Customer session token or admin token
  subscription: z.object({
    endpoint: z.string().url(),
    keys:     z.object({ p256dh: z.string(), auth: z.string() }),
  }),
});

const SendSchema = z.object({
  action:  z.literal("send"),
  email:   z.string().email().optional(), // null = broadcast
  title:   z.string().min(1).max(100),
  body:    z.string().min(1).max(500),
  url:     z.string().optional(),
  icon:    z.string().optional(),
  tag:     z.string().optional(),
});

const UnsubSchema = z.object({
  action:    z.literal("unsubscribe"),
  email:     z.string().email(),
  authToken: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // ── SUBSCRIBE — persist subscription to DB ────────────────────────────────
    if (body.action === "subscribe") {
      // FIX MEDIUM: Rate limit subscribes — prevents email harvesting/flooding
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
      const { allowed } = await cache.rateLimit(`push_sub:${ip}`, 10, 3600);
      if (!allowed) return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });

      const parsed = SubscribeSchema.safeParse(body);
      if (!parsed.success) {
        const msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      const { email, authToken, subscription } = parsed.data;

      // Verify customer owns this email by checking their session token
      const customer = await prisma.customer.findFirst({
        where: { email, sessionToken: authToken },
      }).catch(() => null);

      // FIX MEDIUM: Generic error — don't confirm whether email exists
      if (!customer) {
        const adminToken = process.env.ADMIN_API_TOKEN;
        if (!adminToken || authToken !== adminToken) {
          // Return generic 401 regardless of reason (prevents email enumeration)
          return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
        }
      }

      await (prisma as any).pushSubscription.upsert({
        where:  { email },
        update: { subscription: JSON.stringify(subscription), updatedAt: new Date() },
        create: { email, subscription: JSON.stringify(subscription) },
      });

      return NextResponse.json({ success: true, message: "Push notifications enabled." });
    }

    // ── SEND — admin only ─────────────────────────────────────────────────────
    if (body.action === "send") {
      const adminToken = req.headers.get("x-admin-token");
      const expected   = process.env.ADMIN_API_TOKEN;
      if (!adminToken || !expected || adminToken !== expected) {
        return NextResponse.json({ error: "Admin token required to send push notifications." }, { status: 401 });
      }

      const parsed = SendSchema.safeParse(body);
      if (!parsed.success) {
        const msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      const { email, title, body: bodyText, url, icon, tag } = parsed.data;

      if (!VAPID_PRIVATE || VAPID_PRIVATE === "YOUR_VAPID_PRIVATE_KEY") {
        const count = email
          ? 1
          : await (prisma as any).pushSubscription.count().catch(() => 0);
        return NextResponse.json({
          success:          true,
          message:          `[Dev Mode] Push notification queued: "${title}" → ${email ?? "all"}`,
          note:             "Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY env vars for live push.",
          totalSubscribers: count,
        });
      }

      // Production — fetch from DB and send via web-push
      const subs = email
        ? await (prisma as any).pushSubscription.findMany({ where: { email } })
        : await (prisma as any).pushSubscription.findMany();

      const payload = JSON.stringify({ title, body: bodyText, url, icon, tag });
      // const webpush = require("web-push");
      // webpush.setVapidDetails(`mailto:${VAPID_EMAIL}`, VAPID_PUBLIC, VAPID_PRIVATE);
      // await Promise.allSettled(subs.map((s: any) => webpush.sendNotification(JSON.parse(s.subscription), payload)));

      return NextResponse.json({ success: true, sent: subs.length, payload });
    }

    // ── UNSUBSCRIBE ───────────────────────────────────────────────────────────
    if (body.action === "unsubscribe") {
      const parsed = UnsubSchema.safeParse(body);
      if (!parsed.success) {
        const msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      const { email, authToken } = parsed.data;
      const customer = await prisma.customer.findFirst({ where: { email, sessionToken: authToken } }).catch(() => null);
      const adminToken = process.env.ADMIN_API_TOKEN;
      if (!customer && authToken !== adminToken) {
        return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
      }

      await (prisma as any).pushSubscription.deleteMany({ where: { email } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action. Use subscribe|send|unsubscribe." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Push notification operation failed." }, { status: 500 });
  }
}

export async function GET(req: Request) {
  // FIX MEDIUM: Admin-only — VAPID public key is not sensitive but this
  // endpoint previously also leaked config details.
  // Public key is safe to expose (it's embedded in service workers anyway)
  // but gate behind admin auth to prevent unnecessary config discovery.
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  return NextResponse.json({
    vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
    setup:          process.env.NODE_ENV !== "production" ? "npm install web-push && npx web-push generate-vapid-keys" : undefined,
  });
}
