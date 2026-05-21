import { NextResponse } from "next/server";
import { requireAdmin, requireAuth } from "@/lib/auth-middleware";
import { z } from "zod";

/**
 * B2B Wholesale Portal (G-169, G-150)
 * Separate pricing tiers, credit terms, bulk ordering for business customers
 */

const B2BApplicationSchema = z.object({
  companyName:    z.string().min(1).max(200),
  contactName:    z.string().min(1).max(100),
  email:          z.string().email(),
  phone:          z.string().min(5).max(20),
  website:        z.string().url().optional(),
  vatNumber:      z.string().min(5).max(20).optional(),
  companyReg:     z.string().optional(),
  monthlyVolume:  z.number().positive().optional(), // Estimated monthly spend
  creditTerms:    z.enum(["pay_on_order", "net_30", "net_60"]).default("pay_on_order"),
  industry:       z.string().max(100).optional(),
});

const B2BPriceSchema = z.object({
  productId:    z.number().int().positive(),
  accountId:    z.number().int().positive(),
  price:        z.number().positive(),
  minQty:       z.number().int().positive().default(1),
});

// ── GET /api/b2b — admin: list accounts | authenticated B2B customer: get their pricing ─
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId");
  const authErr   = requireAdmin(req);
  const isAdmin   = !authErr;

  // FIX H-B3-1: All callers must be authenticated (admin or valid B2B session)
  // FIX IDOR: Non-admin users must authenticate and can only access their own account
  if (!isAdmin) {
    const authResult = requireAuth(req);
    if (authResult instanceof NextResponse) {
      return authResult; // Return 401 if not authenticated
    }
    
    // Extract user's accountId from their JWT token
    const userAccountId = authResult.b2bAccountId;
    
    if (!userAccountId) {
      return NextResponse.json({ error: "No B2B account associated with this user." }, { status: 403 });
    }
    
    if (!accountId) {
      return NextResponse.json({ error: "accountId required." }, { status: 400 });
    }
    
    const requestedAccountId = parseInt(accountId, 10);
    if (!requestedAccountId || requestedAccountId <= 0) {
      return NextResponse.json({ error: "Invalid accountId." }, { status: 400 });
    }
    
    // IDOR FIX: Verify the requested accountId matches the user's own accountId
    if (requestedAccountId !== userAccountId) {
      return NextResponse.json({ error: "Access denied. You can only access your own account data." }, { status: 403 });
    }
  }

  try {
    const { prisma } = await import("@/lib/prisma");

    if (isAdmin && !accountId) {
      // Admin: list all B2B accounts
      const accounts = await (prisma as any).b2bAccount.findMany({
        orderBy: { companyName: "asc" },
      });
      return NextResponse.json(accounts);
    }

    const numId = parseInt(accountId!, 10);
    if (!numId || numId <= 0) {
      return NextResponse.json({ error: "Invalid accountId." }, { status: 400 });
    }

    const pricing = await (prisma as any).b2bPrice.findMany({
      where:   { accountId: numId },
      include: { product: { select: { id: true, name: true, price: true, unit: true, category: true } } },
    });
    return NextResponse.json(pricing);
  } catch {
    return NextResponse.json({ error: "Failed to fetch B2B data." }, { status: 500 });
  }
}

// ── POST /api/b2b — apply for wholesale account ───────────────────────────────
export async function POST(req: Request) {
  try {
    const parsed = B2BApplicationSchema.safeParse(await req.json());
    if (!parsed.success) { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }

    const { prisma } = await import("@/lib/prisma");
    const account = await (prisma as any).b2bAccount.create({
      data: { ...parsed.data, status: "pending", discountRate: 0, creditLimit: 0 },
    });

    return NextResponse.json({
      success:   true,
      accountId: account.id,
      message:   "Application received. Our team will review and contact you within 2 business days.",
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Application failed." }, { status: 500 });
  }
}

// ── PUT /api/b2b — admin: approve account / set pricing ──────────────────────
export async function PUT(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const { prisma } = await import("@/lib/prisma");
    const { accountId, status, discountRate, creditLimit, b2bPrice } = await req.json();

    if (accountId) {
      await (prisma as any).b2bAccount.update({
        where: { id: accountId },
        data:  { status, discountRate, creditLimit },
      });
    }

    if (b2bPrice) {
      const parsed = B2BPriceSchema.safeParse(b2bPrice);
      if (!parsed.success) { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }
      await (prisma as any).b2bPrice.upsert({
        where:  { accountId_productId: { accountId: parsed.data.accountId, productId: parsed.data.productId } },
        update: { price: parsed.data.price, minQty: parsed.data.minQty },
        create: parsed.data,
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to update B2B account." }, { status: 500 });
  }
}
