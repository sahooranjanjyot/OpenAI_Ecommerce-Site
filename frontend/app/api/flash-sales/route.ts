import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/auth-middleware";
import { z } from "zod";
import { logger } from "../../../lib/logger";

/**
 * Flash Sales / Time-Limited Deals (G-145, G-164)
 * Creates scheduled promotions with countdown timers
 */

const FlashSaleSchema = z.object({
  name:       z.string().min(1).max(200),
  discount:   z.number().min(1).max(90), // % off
  productIds: z.array(z.number().int().positive()).min(1),
  startAt:    z.string().datetime(),
  endAt:      z.string().datetime(),
  maxUses:    z.number().int().positive().optional(),
  code:       z.string().max(20).optional(), // optional coupon code
  active:     z.boolean().default(true),
});

/**
 * Safely parse productIds JSON from database
 * Returns empty array if JSON is invalid/malformed
 */
function safeParseProductIds(productIdsJson: string | null | undefined, saleId?: number): number[] {
  if (!productIdsJson) {
    return [];
  }
  try {
    const parsed = JSON.parse(productIdsJson);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    logger.warn("productIds is not an array", { saleId, type: typeof parsed });
    return [];
  } catch (error) {
    logger.warn("Failed to parse productIds JSON", { 
      saleId, 
      error: error instanceof Error ? error.message : "Unknown error",
      rawValue: productIdsJson.substring(0, 100) // Log first 100 chars for debugging
    });
    return [];
  }
}

// ── GET /api/flash-sales — active sales with countdown ────────────────────────
export async function GET(req: Request) {
  try {
    const { prisma } = await import("../../../lib/prisma");
    const now   = new Date();
    const sales = await (prisma as any).flashSale.findMany({
      where:   { active: true, startAt: { lte: now }, endAt: { gte: now } },
      orderBy: { endAt: "asc" },
    });

    const enriched = await Promise.all(sales.map(async (sale: any) => {
      const productIds = safeParseProductIds(sale.productIds, sale.id);
      const products   = productIds.length > 0 
        ? await prisma.product.findMany({
            where:  { id: { in: productIds }, enabled: true },
            select: { id: true, name: true, price: true, image: true, unit: true },
          })
        : [];
      const endsIn    = Math.max(0, Math.floor((new Date(sale.endAt).getTime() - now.getTime()) / 1000));
      const hours     = Math.floor(endsIn / 3600);
      const minutes   = Math.floor((endsIn % 3600) / 60);
      const seconds   = endsIn % 60;

      return {
        ...sale,
        products,
        countdown:  { total: endsIn, hours, minutes, seconds },
        countdownText: `${hours}h ${minutes}m ${seconds}s`,
        urgency:    endsIn < 3600 ? "ending_soon" : endsIn < 86400 ? "today_only" : "active",
      };
    }));

    return NextResponse.json(enriched);
  } catch {
    return NextResponse.json({ error: "Failed to fetch flash sales." }, { status: 500 });
  }
}

// ── POST — admin: create flash sale ──────────────────────────────────────────
export async function POST(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const { prisma }  = await import("../../../lib/prisma");
    const parsed = FlashSaleSchema.safeParse(await req.json());
    if (!parsed.success) { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }

    const { productIds, ...data } = parsed.data;
    const sale = await (prisma as any).flashSale.create({
      data: { ...data, productIds: JSON.stringify(productIds), usedCount: 0 },
    });
    return NextResponse.json(sale, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create flash sale." }, { status: 500 });
  }
}

// ── PUT — admin: activate/deactivate ─────────────────────────────────────────
export async function PUT(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const { prisma } = await import("../../../lib/prisma");
    const { id, active } = await req.json();
    const sale = await (prisma as any).flashSale.update({ where: { id }, data: { active } });
    return NextResponse.json(sale);
  } catch {
    return NextResponse.json({ error: "Failed to update flash sale." }, { status: 500 });
  }
}
