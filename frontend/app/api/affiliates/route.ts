import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-middleware";
import { z } from "zod";

/**
 * Affiliate / Influencer Program (G-105, G-106, G-148, G-149)
 *
 * FIX C-B5-1: Commission calculated from DB order total, NOT client-provided orderTotal
 * FIX H-B5-03: Affiliate code lookup returns minimal info; no name/type leakage
 * FIX H-B5-03: Generic error for invalid/inactive codes to prevent enumeration
 */

const AffiliateSchema = z.object({
  name:           z.string().min(1).max(200),
  email:          z.string().email(),
  website:        z.string().url().optional(),
  type:           z.enum(["affiliate", "influencer", "partner"]).default("affiliate"),
  commissionRate: z.number().min(0).max(50).default(5),
  couponCode:     z.string().min(3).max(20).toUpperCase().optional(),
});

// FIX: orderTotal removed — fetched from DB
const TrackSchema = z.object({
  affiliateCode: z.string().min(3).max(20).toUpperCase(),
  orderId:       z.number().int().positive(),
});

export async function GET(req: Request) {
  const { prisma: db } = await import("@/lib/prisma");
  const authErr = requireAdmin(req);

  if (authErr) {
    // Public: validate affiliate code for storefront — returns minimal info only
    const code = new URL(req.url).searchParams.get("code");
    if (!code) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

    const affiliate = await (db as any).affiliate.findUnique({
      where:  { code: code.toUpperCase() },
      select: { active: true, code: true }, // FIX: never expose name/type publicly
    });

    // FIX: same error for missing AND inactive — prevents enumeration
    if (!affiliate || !affiliate.active) {
      return NextResponse.json({ valid: false }, { status: 200 });
    }
    return NextResponse.json({ valid: true, code: affiliate.code });
  }

  try {
    const affiliates = await (db as any).affiliate.findMany({ orderBy: { totalEarnings: "desc" } });
    return NextResponse.json(affiliates);
  } catch {
    return NextResponse.json({ error: "Failed to fetch affiliates." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { prisma: db } = await import("@/lib/prisma");
  const { randomBytes } = await import("crypto");

  const authErr = requireAdmin(req);

  // ── Public: Track affiliate conversion ────────────────────────────────────
  if (authErr) {
    const body   = await req.json().catch(() => null);
    const parsed = TrackSchema.safeParse(body);
    if (!parsed.success) { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }

    try {
      const { affiliateCode, orderId } = parsed.data;

      const [affiliate, order] = await Promise.all([
        (db as any).affiliate.findUnique({ where: { code: affiliateCode, active: true } }),
        prisma.order.findUnique({ where: { id: orderId }, select: { id: true, total: true, affiliateTracked: true, status: true } }),
      ]);

      if (!affiliate) return NextResponse.json({ error: "Invalid affiliate code." }, { status: 404 });
      if (!order)     return NextResponse.json({ error: "Order not found." },        { status: 404 });

      // Prevent double-tracking (C-B5-1)
      if (order.affiliateTracked) {
        return NextResponse.json({ error: "Order already attributed." }, { status: 409 });
      }

      // Prevent tracking on cancelled/refunded orders
      if (["cancelled", "refunded"].includes(order.status)) {
        return NextResponse.json({ error: "Cannot track cancelled or refunded order." }, { status: 400 });
      }

      // FIX C-B5-1: Commission from DB order.total — NOT client-provided value
      const commission = parseFloat((order.total * (affiliate.commissionRate / 100)).toFixed(2));

      await (db as any).$transaction([
        (db as any).affiliate.update({
          where: { code: affiliateCode },
          data:  { totalClicks: { increment: 1 }, totalEarnings: { increment: commission } },
        }),
        prisma.order.update({
          where: { id: orderId },
          data:  { affiliateTracked: true, affiliateCode },
        }),
      ]);

      return NextResponse.json({ success: true, commission, affiliateCode });
    } catch {
      return NextResponse.json({ error: "Failed to track conversion." }, { status: 500 });
    }
  }

  // ── Admin: Create affiliate ───────────────────────────────────────────────
  try {
    const parsed = AffiliateSchema.safeParse(await req.json());
    if (!parsed.success) { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }

    const code      = parsed.data.couponCode ?? randomBytes(4).toString("hex").toUpperCase();
    const affiliate = await (db as any).affiliate.create({
      data: { ...parsed.data, code, couponCode: code, totalClicks: 0, totalEarnings: 0, active: true },
    });
    return NextResponse.json(affiliate, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create affiliate." }, { status: 500 });
  }
}
