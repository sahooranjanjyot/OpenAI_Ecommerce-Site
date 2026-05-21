import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-middleware";
import { z } from "zod";

/**
 * Multi-Warehouse / Multi-Location Inventory (G-074)
 * Track stock per location: store, warehouse, delivery hub
 */

const LocationSchema = z.object({
  name:     z.string().min(1).max(200),
  type:     z.enum(["store","warehouse","hub","supplier"]),
  address:  z.string().max(500).optional(),
  active:   z.boolean().default(true),
});

const StockMoveSchema = z.object({
  productId:   z.number().int().positive(),
  fromLocation: z.number().int().positive().optional(),
  toLocation:  z.number().int().positive(),
  qty:         z.number().positive(),
  reason:      z.string().max(200).optional().default("transfer"),
});

// ── GET /api/warehouses — list locations or stock for location ────────────────
export async function GET(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const { prisma } = await import("@/lib/prisma");
    const { searchParams } = new URL(req.url);
    const locationId = parseInt(searchParams.get("locationId") ?? "0", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    if (locationId) {
      // Stock at specific location with pagination
      const stock = await (prisma as any).locationStock.findMany({
        where:   { locationId },
        include: { product: { select: { id: true, name: true, category: true, unit: true } } },
        orderBy: { qty: "asc" },
        take:    limit,
        skip:    offset,
      });
      return NextResponse.json(stock);
    }

    const [locations, summary] = await Promise.all([
      (prisma as any).location.findMany({
        orderBy: { name: "asc" },
        take:    limit,
        skip:    offset,
      }),
      (prisma as any).locationStock.groupBy({
        by:    ["locationId"],
        _sum:  { qty: true },
        _count: { productId: true },
      }),
    ]);

    const enriched = locations.map((loc: any) => {
      const s = summary.find((x: any) => x.locationId === loc.id);
      return { ...loc, totalStock: s?._sum.qty ?? 0, skuCount: s?._count.productId ?? 0 };
    });

    return NextResponse.json(enriched);
  } catch {
    return NextResponse.json({ error: "Failed to fetch warehouses." }, { status: 500 });
  }
}

// ── POST /api/warehouses — create location ────────────────────────────────────
export async function POST(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const { prisma } = await import("@/lib/prisma");
    const body = await req.json();

    if (body.action === "stock_move") {
      // Move stock between locations
      const parsed = StockMoveSchema.safeParse(body);
      if (!parsed.success) { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }
      const { productId, fromLocation, toLocation, qty, reason } = parsed.data;

      // Deduct from source
      if (fromLocation) {
        const src = await (prisma as any).locationStock.findFirst({ where: { locationId: fromLocation, productId } });
        if (!src || src.qty < qty) return NextResponse.json({ error: "Insufficient stock at source location." }, { status: 400 });
        await (prisma as any).locationStock.update({ where: { id: src.id }, data: { qty: { decrement: qty } } });
      }

      // Add to destination
      await (prisma as any).locationStock.upsert({
        where:  { locationId_productId: { locationId: toLocation, productId } },
        update: { qty: { increment: qty } },
        create: { locationId: toLocation, productId, qty },
      });

      return NextResponse.json({ success: true, moved: qty, reason });
    }

    const parsed = LocationSchema.safeParse(body);
    if (!parsed.success) { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }
    const location = await (prisma as any).location.create({ data: parsed.data });
    return NextResponse.json(location, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed." }, { status: 500 });
  }
}
