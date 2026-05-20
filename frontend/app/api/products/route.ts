import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { z } from "zod";

// ── Input Validation (G-011, G-014) ──────────────────────────────────────────
const ProductSchema = z.object({
  name:        z.string().min(1).max(200),
  category:    z.string().min(1).max(100),
  price:       z.number().positive("Price must be positive"),
  wasPrice:    z.number().positive().optional().nullable(),
  onSale:      z.boolean().optional().default(false),
  stock:       z.number().int().min(0, "Stock cannot be negative"),
  unit:        z.string().min(1).max(50),
  image:       z.string().optional().default(""),
  description: z.string().max(2000).optional().default(""),
  enabled:     z.boolean().optional().default(true),
  hidden:      z.boolean().optional().default(false),
  featured:    z.boolean().optional().default(false),
});

const UpdateProductSchema = ProductSchema.partial().extend({
  id: z.number().int().positive("Valid product ID required"),
});

// ── GET /api/products — public read with pagination ──────────────────────────
// FIX C-B2-5: Removed auto-seed from GET endpoint (was a race condition risk)
// FIX PERF-002: Added pagination — no longer returns all rows
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page     = Math.max(1, parseInt(searchParams.get("page")     ?? "1",  10));
    const limit    = Math.min(100, parseInt(searchParams.get("limit")   ?? "24", 10));
    const category = searchParams.get("category") ?? undefined;
    const featured = searchParams.get("featured") === "true" ? true : undefined;
    const enabled  = searchParams.get("all") === "true" ? undefined : true;

    const where: any = {};
    if (enabled  !== undefined) where.enabled  = enabled;
    if (category !== undefined) where.category = category;
    if (featured !== undefined) where.featured = featured;

    const [products, total] = await Promise.all([
      prisma.product.findMany({ where, orderBy: { createdAt: "desc" }, take: limit, skip: (page - 1) * limit }),
      prisma.product.count({ where }),
    ]);

    return NextResponse.json({ products, total, page, pages: Math.ceil(total / limit), limit });
  } catch {
    return NextResponse.json({ error: "Failed to fetch products." }, { status: 500 });
  }
}

// ── POST /api/products — admin only: create product ─────────────────────────
export async function POST(req: Request) {
  // G-002: Admin auth check
  const adminToken = req.headers.get("x-admin-token");
  if (adminToken !== process.env.ADMIN_API_TOKEN) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  try {
    const raw = await req.json();
    const parsed = ProductSchema.safeParse(raw);
    if (!parsed.success) {
      { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }
    }

    const product = await prisma.product.create({ data: parsed.data });
    return NextResponse.json(product, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create product." }, { status: 500 });
  }
}

// ── PUT /api/products — admin only: update product ───────────────────────────
export async function PUT(req: Request) {
  const adminToken = req.headers.get("x-admin-token");
  if (adminToken !== process.env.ADMIN_API_TOKEN) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  try {
    const raw = await req.json();
    const parsed = UpdateProductSchema.safeParse(raw);
    if (!parsed.success) {
      { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }
    }

    const { id, ...data } = parsed.data;
    const product = await prisma.product.update({ where: { id }, data });
    return NextResponse.json(product);
  } catch {
    return NextResponse.json({ error: "Failed to update product." }, { status: 500 });
  }
}

// ── DELETE /api/products — admin only: delete product ────────────────────────
export async function DELETE(req: Request) {
  const adminToken = req.headers.get("x-admin-token");
  if (adminToken !== process.env.ADMIN_API_TOKEN) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const rawId = searchParams.get("id");
    if (!rawId) return NextResponse.json({ error: "Product ID is required." }, { status: 400 });

    const id = parseInt(rawId, 10);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid product ID." }, { status: 400 });

    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete product." }, { status: 500 });
  }
}
