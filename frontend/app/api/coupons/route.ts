import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { requireAdmin } from "../../../lib/auth-middleware";
import { z } from "zod";

// ── Validation ──────────────────────────────────────────────────────────────
const CouponSchema = z.object({
  code:          z.string().min(3).max(50).toUpperCase(),
  type:          z.enum(["percent", "fixed", "free_shipping"]),
  value:         z.number().min(0),
  minOrderValue: z.number().min(0).optional().default(0),
  maxUses:       z.number().int().positive().optional().nullable(),
  expiresAt:     z.string().datetime().optional().nullable(),
  active:        z.boolean().optional().default(true),
});

const RedeemSchema = z.object({
  code:    z.string().min(1).max(50),
  orderId: z.number().int().positive(),
});

// ── GET /api/coupons — admin: list all  |  public: validate a code ───────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  // Public: validate a single coupon code (read-only — no usage increment here)
  if (code) {
    try {
      const coupon = await (prisma as any).coupon.findUnique({
        where: { code: code.toUpperCase() },
      });
      if (!coupon || !coupon.active) {
        return NextResponse.json({ valid: false, error: "Coupon code not found or inactive." }, { status: 404 });
      }
      if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
        return NextResponse.json({ valid: false, error: "This coupon has expired." }, { status: 400 });
      }
      if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
        return NextResponse.json({ valid: false, error: "This coupon has reached its usage limit." }, { status: 400 });
      }
      return NextResponse.json({
        valid:         true,
        code:          coupon.code,
        type:          coupon.type,
        value:         coupon.value,
        minOrderValue: coupon.minOrderValue,
      });
    } catch {
      return NextResponse.json({ valid: false, error: "Coupon lookup failed." }, { status: 500 });
    }
  }

  // Admin: list all coupons with pagination
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);
    const skip = (page - 1) * limit;

    const [coupons, total] = await Promise.all([
      (prisma as any).coupon.findMany({
        orderBy: { id: "desc" },
        skip,
        take: limit,
      }),
      (prisma as any).coupon.count(),
    ]);

    return NextResponse.json({
      data: coupons,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch coupons." }, { status: 500 });
  }
}

// ── POST /api/coupons — admin: create coupon ──────────────────────────────────
export async function POST(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  try {
    const parsed = CouponSchema.safeParse(await req.json());
    if (!parsed.success) { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }

    const exists = await (prisma as any).coupon.findUnique({ where: { code: parsed.data.code } });
    if (exists) return NextResponse.json({ error: "Coupon code already exists." }, { status: 400 });

    const coupon = await (prisma as any).coupon.create({ data: { ...parsed.data, usedCount: 0 } });
    return NextResponse.json(coupon, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create coupon." }, { status: 500 });
  }
}

// ── PUT /api/coupons — admin: update ─────────────────────────────────────────
export async function PUT(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const { id, ...data } = await req.json();
    const coupon = await (prisma as any).coupon.update({ where: { id }, data });
    return NextResponse.json(coupon);
  } catch {
    return NextResponse.json({ error: "Failed to update coupon." }, { status: 500 });
  }
}

// ── DELETE /api/coupons — admin: delete ──────────────────────────────────────
export async function DELETE(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const id = parseInt(new URL(req.url).searchParams.get("id") ?? "0", 10);
    await (prisma as any).coupon.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete coupon." }, { status: 500 });
  }
}
