import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-middleware";
import { z } from "zod";

/**
 * Price Rules Engine (G-022, G-024, G-016)
 * Dynamic pricing: category discounts, customer-tier pricing, time-based pricing
 */

const PriceRuleSchema = z.object({
  name:       z.string().min(1).max(200),
  type:       z.enum(["category_discount","customer_tier","time_based","bulk_discount","clearance"]),
  target:     z.string().max(200),  // category name, tier name, or "all"
  discount:   z.number().min(0).max(90),
  minQty:     z.number().int().min(1).optional().default(1),
  startAt:    z.string().datetime().optional(),
  endAt:      z.string().datetime().optional(),
  active:     z.boolean().default(true),
  priority:   z.number().int().min(1).max(100).default(50), // higher = applied first
});

const ApplyRuleSchema = z.object({
  productId:    z.number().int().positive(),
  customerId:   z.number().int().positive().optional(),
  customerTier: z.string().optional().default("standard"),
  qty:          z.number().int().positive().default(1),
  couponCode:   z.string().optional(),
});

// ── GET — list price rules (admin) ────────────────────────────────────────────
export async function GET(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const { prisma } = await import("@/lib/prisma");
    const rules = await (prisma as any).priceRule.findMany({ orderBy: [{ priority: "desc" }, { createdAt: "desc" }] });
    return NextResponse.json(rules);
  } catch {
    return NextResponse.json({ error: "Failed to fetch price rules." }, { status: 500 });
  }
}

// ── POST — create rule (admin) | apply rules (public) ─────────────────────────
export async function POST(req: Request) {
  const body = await req.json();

  if (body.action === "calculate") {
    // Public: calculate final price for product
    try {
      const parsed = ApplyRuleSchema.safeParse(body);
      if (!parsed.success) { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }

      const { productId, customerTier, qty, couponCode } = parsed.data;
      const { prisma } = await import("@/lib/prisma");

      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });

      const now   = new Date();
      const rules = await (prisma as any).priceRule.findMany({
        where: {
          active: true,
          OR: [
            { startAt: null },
            { startAt: { lte: now } },
          ],
          AND: [
            { OR: [{ endAt: null }, { endAt: { gte: now } }] },
          ],
        },
        orderBy: { priority: "desc" },
      });

      let discount    = 0;
      let appliedRules: string[] = [];

      for (const rule of rules) {
        let applies = false;
        if (rule.type === "category_discount" && product.category === rule.target) applies = true;
        if (rule.type === "customer_tier"    && customerTier === rule.target)       applies = true;
        if (rule.type === "bulk_discount"    && qty >= rule.minQty)                 applies = true;
        if (rule.type === "clearance"        && rule.target === "all")              applies = true;
        if (rule.type === "time_based")                                             applies = true;

        if (applies && rule.discount > discount) {
          discount     = rule.discount;
          appliedRules = [rule.name];
        }
      }

      // Apply coupon on top
      if (couponCode) {
        const coupon = await (prisma as any).coupon.findUnique({ where: { code: couponCode } });
        if (coupon?.active && coupon.type === "percent" && coupon.value > discount) {
          discount     = coupon.value;
          appliedRules = [`${coupon.code} coupon`];
        }
      }

      const originalPrice = product.price;
      const finalPrice    = parseFloat((originalPrice * (1 - discount / 100)).toFixed(2));
      const saving        = parseFloat((originalPrice - finalPrice).toFixed(2));

      return NextResponse.json({
        productId, originalPrice, finalPrice, discount, saving,
        appliedRules,
        lineTotal: parseFloat((finalPrice * qty).toFixed(2)),
      });
    } catch {
      return NextResponse.json({ error: "Price calculation failed." }, { status: 500 });
    }
  }

  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const { prisma } = await import("@/lib/prisma");
    const parsed = PriceRuleSchema.safeParse(body);
    if (!parsed.success) { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }
    const rule = await (prisma as any).priceRule.create({ data: parsed.data });
    return NextResponse.json(rule, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create price rule." }, { status: 500 });
  }
}
