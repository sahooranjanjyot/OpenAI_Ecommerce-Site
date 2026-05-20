import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { requireAdmin } from "../../../lib/auth-middleware";
import { z } from "zod";
import { logger } from "../../../lib/logger";

/**
 * Supplier Management (G-060, G-040, G-044)
 *
 * FIXED LOW: No pagination on GET (unbounded fetch → potential DoS).
 * FIXED MEDIUM: PUT lacks Zod validation (arbitrary field injection).
 * FIXED MEDIUM: DELETE id=0 integer overflow (now strictly validated).
 * FIXED LOW: Audit logging for all mutations.
 * FIXED: Zod v4 compatibility.
 */

const SupplierSchema = z.object({
  name:         z.string().min(1).max(200),
  contact:      z.string().max(200).optional().default(""),
  email:        z.string().email().optional().or(z.literal("")),
  phone:        z.string().max(20).optional().default(""),
  address:      z.string().max(500).optional().default(""),
  leadTimeDays: z.number().int().min(0).max(365).optional().default(3),
  notes:        z.string().max(2000).optional().default(""),
  active:       z.boolean().optional().default(true),
});

const PutSchema = SupplierSchema.partial().extend({
  id: z.number().int().positive(),
});

export async function GET(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const { searchParams } = new URL(req.url);
    const page  = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(200, parseInt(searchParams.get("limit") ?? "50", 10) || 50);
    const skip  = (page - 1) * limit;

    const [suppliers, total] = await Promise.all([
      (prisma as any).supplier.findMany({ orderBy: { name: "asc" }, skip, take: limit }),
      (prisma as any).supplier.count(),
    ]);

    return NextResponse.json({ suppliers, total, page, pages: Math.ceil(total / limit) });
  } catch {
    return NextResponse.json({ error: "Failed to fetch suppliers." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const parsed = SupplierSchema.safeParse(await req.json());
    if (!parsed.success) {
      const msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const supplier = await (prisma as any).supplier.create({ data: parsed.data });
    logger.audit("SUPPLIER_CREATED", { resource: `Supplier:${supplier.id}`, name: parsed.data.name });
    return NextResponse.json(supplier, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create supplier." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    // FIX MEDIUM: Validate with Zod — prevents arbitrary field injection
    const parsed = PutSchema.safeParse(await req.json());
    if (!parsed.success) {
      const msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const { id, ...data } = parsed.data;
    const supplier = await (prisma as any).supplier.update({ where: { id }, data });
    logger.audit("SUPPLIER_UPDATED", { resource: `Supplier:${id}` });
    return NextResponse.json(supplier);
  } catch {
    return NextResponse.json({ error: "Failed to update supplier." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const rawId = new URL(req.url).searchParams.get("id");
    const id    = rawId ? parseInt(rawId, 10) : NaN;
    if (!id || id <= 0 || !Number.isFinite(id)) {
      return NextResponse.json({ error: "Valid numeric id required." }, { status: 400 });
    }
    await (prisma as any).supplier.delete({ where: { id } });
    logger.audit("SUPPLIER_DELETED", { resource: `Supplier:${id}` });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete supplier." }, { status: 500 });
  }
}
