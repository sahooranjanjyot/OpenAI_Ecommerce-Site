import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { requireAdmin } from "../../../lib/auth-middleware";
import { z } from "zod";

// ── Product Variants (G-059, G-043) ──────────────────────────────────────────
// Variants: size, colour, weight attached to a parent product
const VariantSchema = z.object({
  productId:  z.number().int().positive(),
  name:       z.string().min(1).max(100),  // e.g. "500g", "Red", "Large"
  attribute:  z.string().min(1).max(50),   // e.g. "weight", "colour", "size"
  value:      z.string().min(1).max(100),  // e.g. "500", "red", "L"
  price:      z.number().positive(),
  stock:      z.number().int().min(0),
  sku:        z.string().max(50).optional().default(""),
  image:      z.string().optional().default(""),
  enabled:    z.boolean().optional().default(true),
});

export async function GET(req: Request) {
  try {
    const productId = parseInt(new URL(req.url).searchParams.get("productId") ?? "0", 10);
    const where     = productId ? { productId, enabled: true } : {};
    const variants  = await (prisma as any).productVariant.findMany({ where, orderBy: { attribute: "asc" } });
    return NextResponse.json(variants);
  } catch {
    return NextResponse.json({ error: "Failed to fetch variants." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const parsed = VariantSchema.safeParse(await req.json());
    if (!parsed.success) { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }
    const variant = await (prisma as any).productVariant.create({ data: parsed.data });
    return NextResponse.json(variant, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create variant." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const { id, ...data } = await req.json();
    const variant = await (prisma as any).productVariant.update({ where: { id }, data });
    return NextResponse.json(variant);
  } catch {
    return NextResponse.json({ error: "Failed to update variant." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const id = parseInt(new URL(req.url).searchParams.get("id") ?? "0", 10);
    await (prisma as any).productVariant.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete variant." }, { status: 500 });
  }
}
