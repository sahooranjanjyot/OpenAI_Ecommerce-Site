import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { requireAdmin } from "../../../lib/auth-middleware";
import { z } from "zod";

// ── Validation ────────────────────────────────────────────────────────────────
const UpdateCustomerSchema = z.object({
  id:      z.number().int().positive(),
  notes:   z.string().max(2000).optional(),
  blocked: z.boolean().optional(),
  name:    z.string().min(1).max(200).optional(),
  email:   z.string().email().optional(),
  phone:   z.string().max(20).optional(),
});

// ── GET /api/customers — admin only ──────────────────────────────────────────
export async function GET(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  try {
    const { searchParams } = new URL(req.url);
    const page    = Math.max(1,   parseInt(searchParams.get("page")  ?? "1",  10) || 1);
    const limit   = Math.min(100, parseInt(searchParams.get("limit") ?? "20", 10) || 20);
    const skip    = (page - 1) * limit;
    const search  = searchParams.get("search")?.trim();
    const blocked = searchParams.get("blocked");

    const where: any = {};
    if (blocked !== null) where.blocked = blocked === "true";
    if (search) {
      where.OR = [
        { name:  { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { id: "desc" },
        skip,
        take: limit,
      }),
      prisma.customer.count({ where }),
    ]);

    // Strip sensitive fields
    const safe = data.map(({ password: _pw, passwordHash: _ph, ...c }: any) => c);
    return NextResponse.json({ customers: safe, total, page, pages: Math.ceil(total / limit) });
  } catch {
    return NextResponse.json({ error: "Failed to fetch customers." }, { status: 500 });
  }
}


// ── PUT /api/customers — admin only ──────────────────────────────────────────
export async function PUT(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  try {
    const raw = await req.json();
    const parsed = UpdateCustomerSchema.safeParse(raw);
    if (!parsed.success) {
      { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }
    }

    const { id, ...data } = parsed.data;

    if (data.email) {
      const eCheck = await prisma.customer.findUnique({ where: { email: data.email } });
      if (eCheck && eCheck.id !== id) {
        return NextResponse.json({ error: "Email already in use by another account." }, { status: 400 });
      }
    }

    const updated = await prisma.customer.update({ where: { id }, data });
    const { password: _pw, ...safe } = updated;
    return NextResponse.json(safe);
  } catch {
    return NextResponse.json({ error: "Failed to update customer." }, { status: 500 });
  }
}

// ── DELETE /api/customers — GDPR Right to Erasure (G-035) ────────────────────
export async function DELETE(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  try {
    const { searchParams } = new URL(req.url);
    const rawId = searchParams.get("id");
    if (!rawId) return NextResponse.json({ error: "Customer ID is required." }, { status: 400 });

    const id = parseInt(rawId, 10);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid customer ID." }, { status: 400 });

    // Anonymise rather than hard-delete for order history integrity (GDPR compliant erasure)
    await prisma.customer.update({
      where: { id },
      data: {
        name:     "[Deleted]",
        email:    `deleted_${id}@erased.local`,
        phone:    `deleted_${id}`,
        address:  "",
        notes:    "",
        password: "",
        blocked:  false,
      },
    });

    return NextResponse.json({ success: true, message: "Customer data erased (GDPR Art. 17)." });
  } catch {
    return NextResponse.json({ error: "Failed to erase customer." }, { status: 500 });
  }
}
