import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "../../../lib/auth-middleware";

/**
 * Abandoned Cart Recovery (G-069, G-030)
 * Automated email sequence: 1h, 24h, 72h after abandonment
 *
 * FIXED H-B5-1: PUT (cart recovery cron trigger) now requires admin auth.
 *   Anyone could previously trigger mass email sends externally.
 * FIXED: Zod v4 .issues compatibility.
 */

const AbandonSchema = z.object({
  sessionId: z.string().min(1),
  email:     z.string().email().optional(),
  items:     z.array(z.object({
    id:    z.number(),
    name:  z.string(),
    price: z.number(),
    qty:   z.number(),
  })).min(1),
});

// ── POST /api/cart/abandoned — record abandoned cart ─────────────────────────
export async function POST(req: Request) {
  try {
    const parsed = AbandonSchema.safeParse(await req.json());
    if (!parsed.success) {
      const msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { sessionId, email, items } = parsed.data;
    const { prisma } = await import("../../../lib/prisma");

    await prisma.abandonedCart.upsert({
      where:  { sessionId },
      update: { items: JSON.stringify(items), email: email ?? undefined, updatedAt: new Date() },
      create: { sessionId, email: email ?? undefined, items: JSON.stringify(items) },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to save cart." }, { status: 500 });
  }
}

// ── PUT /api/cart/abandoned — send recovery emails (called by cron/admin only) ─
export async function PUT(req: Request) {
  // FIX H-B5-1: Admin auth required — prevents external mass email triggering
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const { prisma } = await import("../../../lib/prisma");
    const now       = new Date();

    // Find carts abandoned > 1h, < 72h, with email, not yet recovered
    const threshold1h  = new Date(now.getTime() - 1  * 60 * 60 * 1000);
    const threshold24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const threshold72h = new Date(now.getTime() - 72 * 60 * 60 * 1000);

    const abandoned = await prisma.abandonedCart.findMany({
      where: {
        email:     { not: undefined },
        updatedAt: { gte: threshold72h, lte: threshold1h },
      },
      take: 50,
    });

    const sent: string[] = [];

    for (const cart of abandoned) {
      if (!cart.email) continue;
      const ageMs   = now.getTime() - new Date(cart.updatedAt).getTime();
      const ageHrs  = ageMs / (1000 * 60 * 60);

      let sequence: "1h" | "24h" | "72h" | null = null;
      if (ageHrs >= 1  && ageHrs < 2)  sequence = "1h";
      if (ageHrs >= 24 && ageHrs < 25) sequence = "24h";
      if (ageHrs >= 72 && ageHrs < 73) sequence = "72h";
      if (!sequence) continue;

      let items: any[] = [];
      try { items = JSON.parse(cart.items); } catch {}

      const total  = items.reduce((s: number, i: any) => s + i.price * i.qty, 0);
      const coupon = sequence === "72h" ? "COMEBACK10" : null;

      if (process.env.RESEND_API_KEY) {
        const { Resend } = await import("resend");
        const resend     = new Resend(process.env.RESEND_API_KEY);
        const subjects   = { "1h": "You left something behind! 🛒", "24h": "Your cart misses you! Come back & save", "72h": "Last chance — your basket expires soon" };

        await resend.emails.send({
          from:    "GroceryOS <onboarding@resend.dev>",
          to:      cart.email,
          subject: subjects[sequence],
          html: `<div style="font-family:system-ui;max-width:520px;margin:0 auto;padding:32px;border:1px solid #e2e8f0;border-radius:8px;">
            <h2 style="color:#7c3aed;">Your shopping cart is waiting 🛒</h2>
            <p>You left ${items.length} item${items.length > 1 ? "s" : ""} (£${total.toFixed(2)}) in your cart.</p>
            <ul style="padding-left:20px;">
              ${items.slice(0, 3).map((i: any) => `<li>${i.name} × ${i.qty} — £${(i.price * i.qty).toFixed(2)}</li>`).join("")}
            </ul>
            ${coupon ? `<p style="background:#ede9fe;padding:12px;border-radius:6px;"><strong>💰 Save 10% — use code: <span style="color:#7c3aed;">${coupon}</span></strong></p>` : ""}
            <a href="${process.env.NEXT_PUBLIC_BASE_URL}/cart" style="display:inline-block;padding:12px 24px;background:#7c3aed;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;margin-top:16px;">Complete My Order</a>
            <p style="color:#94a3b8;font-size:12px;margin-top:24px;">You received this because you started checkout. <a href="${process.env.NEXT_PUBLIC_BASE_URL}/api/newsletter?email=${encodeURIComponent(cart.email)}">Unsubscribe</a></p>
          </div>`,
        });
        sent.push(`${cart.email}:${sequence}`);
      }
    }

    return NextResponse.json({ success: true, sent: sent.length, emails: sent });
  } catch {
    return NextResponse.json({ error: "Cart recovery failed." }, { status: 500 });
  }
}
