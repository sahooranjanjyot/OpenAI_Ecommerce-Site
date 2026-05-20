import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/auth-middleware";
import { z } from "zod";
import { logger } from "../../../lib/logger";

/**
 * Bundles (G-165)
 *
 * FIXED MEDIUM: Missing ID validation on PUT (id not validated → SQL confusion).
 * FIXED MEDIUM: Integer overflow/injection on DELETE (parseInt "0" fallback → delete id=0).
 * FIXED: Zod v4 compatibility.
 * FIXED LOW: Added audit logging for bundle create/update/delete.
 */

const BundleSchema = z.object({
  name:        z.string().min(1).max(200),
  description: z.string().max(1000).optional().default(""),
  productIds:  z.array(z.number().int().positive()).min(2, "Bundle needs at least 2 products").max(50),
  discount:    z.number().min(0).max(100).default(10),
  enabled:     z.boolean().default(true),
  image:       z.string().url().optional().or(z.literal("")).default(""),
});

const PutSchema = BundleSchema.partial().extend({
  id: z.number().int().positive(),
});

// ── GET /api/bundles — public ─────────────────────────────────────────────────
export async function GET(_req: Request) {
  try {
    const { prisma } = await import("../../../lib/prisma");
    const bundles = await (prisma as any).bundle.findMany({
      where:   { enabled: true },
      orderBy: { createdAt: "desc" },
      take:    100,
    });

    const enriched = await Promise.all(bundles.map(async (bundle: any) => {
      const productIds = JSON.parse(bundle.productIds ?? "[]");
      const products   = await prisma.product.findMany({
        where:  { id: { in: productIds }, enabled: true },
        select: { id: true, name: true, price: true, unit: true },
      });
      const totalPrice  = products.reduce((s, p) => s + p.price, 0);
      const bundlePrice = parseFloat((totalPrice * (1 - bundle.discount / 100)).toFixed(2));
      const saving      = parseFloat((totalPrice - bundlePrice).toFixed(2));
      return { ...bundle, products, totalPrice, bundlePrice, saving };
    }));

    return NextResponse.json(enriched);
  } catch {
    return NextResponse.json({ error: "Failed to fetch bundles." }, { status: 500 });
  }
}

// ── POST — admin: create bundle ───────────────────────────────────────────────
export async function POST(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const { prisma } = await import("../../../lib/prisma");
    const parsed = BundleSchema.safeParse(await req.json());
    if (!parsed.success) {
      const msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const { productIds, ...data } = parsed.data;
    const bundle = await (prisma as any).bundle.create({
      data: { ...data, productIds: JSON.stringify(productIds) },
    });
    logger.audit("BUNDLE_CREATED", { resource: `Bundle:${bundle.id}`, name: data.name });
    return NextResponse.json(bundle, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create bundle." }, { status: 500 });
  }
}

// ── PUT — admin: update bundle ────────────────────────────────────────────────
export async function PUT(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const { prisma } = await import("../../../lib/prisma");

    // FIX MEDIUM: Validate with Zod — id was previously unvalidated from req.json()
    const parsed = PutSchema.safeParse(await req.json());
    if (!parsed.success) {
      const msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { id, productIds, ...data } = parsed.data;
    const update: any = { ...data };
    if (productIds !== undefined) update.productIds = JSON.stringify(productIds);

    const bundle = await (prisma as any).bundle.update({ where: { id }, data: update });
    logger.audit("BUNDLE_UPDATED", { resource: `Bundle:${id}` });
    return NextResponse.json(bundle);
  } catch {
    return NextResponse.json({ error: "Failed to update bundle." }, { status: 500 });
  }
}

// ── DELETE — admin ────────────────────────────────────────────────────────────
export async function DELETE(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const { prisma } = await import("../../../lib/prisma");

    // FIX MEDIUM: Validate id — parseInt("0", 10) or NaN previously caused delete({id:0})
    const rawId = new URL(req.url).searchParams.get("id");
    const id    = rawId ? parseInt(rawId, 10) : NaN;
    if (!id || id <= 0 || !Number.isFinite(id)) {
      return NextResponse.json({ error: "Valid numeric id required." }, { status: 400 });
    }

    await (prisma as any).bundle.delete({ where: { id } });
    logger.audit("BUNDLE_DELETED", { resource: `Bundle:${id}` });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete bundle." }, { status: 500 });
  }
}
