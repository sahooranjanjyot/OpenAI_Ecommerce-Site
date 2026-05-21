import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-middleware";
import { z } from "zod";
import { cache } from "@/lib/cache";

/**
 * Layaway / Instalment Payment Plan (G-123)
 * Customer pays in N instalments; goods held until fully paid
 */

const LayawaySchema = z.object({
  email:       z.string().email(),
  productId:   z.number().int().positive(),
  qty:         z.number().int().positive().default(1),
  instalments: z.number().int().min(2).max(12),
  depositPct:  z.number().min(10).max(50).default(25), // % deposit
  address:     z.string().min(5).max(500),
  phone:       z.string().min(5).max(20),
});

// ── GET /api/layaway?email=X — get customer layaway plans ────────────────────
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email   = searchParams.get("email");
    const authErr = requireAdmin(req);
    const { prisma } = await import("@/lib/prisma");

    const where = !authErr ? {} : email ? { email } : {};
    const plans = await (prisma as any).layaway.findMany({ where, orderBy: { createdAt: "desc" } });
    return NextResponse.json(plans);
  } catch {
    return NextResponse.json({ error: "Failed to fetch layaway plans." }, { status: 500 });
  }
}

// ── POST /api/layaway — create instalment plan ────────────────────────────────
export async function POST(req: Request) {
  try {
    // Rate limit: 5 layaways per IP per hour to prevent inventory reservation DoS
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
    const rateLimitKey = `layaway:create:${ip}`;
    const isAllowed = await cache.rateLimit(rateLimitKey, 5, 3600);
    if (!isAllowed) {
      return NextResponse.json({ error: "Rate limit exceeded. Maximum 5 layaway plans per hour." }, { status: 429 });
    }

    const parsed = LayawaySchema.safeParse(await req.json());
    if (!parsed.success) { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }

    const { email, productId, qty, instalments, depositPct, address, phone } = parsed.data;
    const { prisma } = await import("@/lib/prisma");

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });

    const totalAmount  = product.price * qty;
    const depositAmount = Math.round(totalAmount * depositPct) / 100;
    const remaining     = totalAmount - depositAmount;

    // Build payment schedule with proper rounding to avoid floating point errors
    const schedule = [{ n: 1, label: "Deposit", amount: depositAmount, dueDate: new Date().toISOString().slice(0, 10) }];
    
    let sumInstalments = 0;
    const numInstalments = instalments - 1;
    
    for (let i = 2; i <= instalments; i++) {
      const due = new Date(Date.now() + (i - 1) * 30 * 24 * 60 * 60 * 1000);
      let instalmentAmount: number;
      
      if (i === instalments) {
        // Last instalment gets the remainder to ensure total equals exactly remaining
        instalmentAmount = Math.round((remaining - sumInstalments) * 100) / 100;
      } else {
        // Regular instalments are rounded
        instalmentAmount = Math.round((remaining / numInstalments) * 100) / 100;
        sumInstalments += instalmentAmount;
      }
      
      schedule.push({ n: i, label: `Instalment ${i - 1}`, amount: instalmentAmount, dueDate: due.toISOString().slice(0, 10) });
    }

    const plan = await (prisma as any).layaway.create({
      data: {
        email, productId, qty, instalments,
        totalAmount, depositAmount, remaining,
        depositPct, address, phone,
        schedule: JSON.stringify(schedule),
        paidCount: 0, paidAmount: 0, status: "active",
      },
    });

    const regularInstalment = Math.round((remaining / numInstalments) * 100) / 100;
    return NextResponse.json({ success: true, plan, schedule, message: `Pay £${depositAmount} now to reserve. ${instalments - 1} further payments of approximately £${regularInstalment}/month.` }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create layaway plan." }, { status: 500 });
  }
}

// ── PUT /api/layaway — record instalment payment ──────────────────────────────
export async function PUT(req: Request) {
  try {
    const { id, amountPaid, paymentRef } = await req.json();
    const { prisma } = await import("@/lib/prisma");

    const plan = await (prisma as any).layaway.findUnique({ where: { id } });
    if (!plan) return NextResponse.json({ error: "Layaway plan not found." }, { status: 404 });

    // TODO: In production, amountPaid should be verified against a payment webhook
    // (e.g., Stripe webhook confirmation) rather than trusting client-provided values.
    // For now, validate that amountPaid is positive and doesn't exceed outstanding amount.
    const outstandingAmount = plan.totalAmount - plan.paidAmount;
    
    if (typeof amountPaid !== "number" || amountPaid <= 0) {
      return NextResponse.json({ error: "Invalid payment amount. Amount must be greater than 0." }, { status: 400 });
    }
    
    if (amountPaid > outstandingAmount) {
      return NextResponse.json({ error: `Payment amount exceeds outstanding balance of £${outstandingAmount.toFixed(2)}.` }, { status: 400 });
    }

    const newPaid  = parseFloat((plan.paidAmount + amountPaid).toFixed(2));
    const newCount = plan.paidCount + 1;
    const status   = newPaid >= plan.totalAmount ? "complete" : "active";

    const updated = await (prisma as any).layaway.update({
      where: { id },
      data:  { paidAmount: newPaid, paidCount: newCount, status },
    });

    return NextResponse.json({
      success:   true,
      plan:      updated,
      message:   status === "complete" ? "✅ Fully paid! Order will now be processed." : `Payment recorded. £${(plan.totalAmount - newPaid).toFixed(2)} remaining.`,
    });
  } catch {
    return NextResponse.json({ error: "Failed to record payment." }, { status: 500 });
  }
}
