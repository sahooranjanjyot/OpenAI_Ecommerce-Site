import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-middleware";
import { z } from "zod";

/**
 * GDPR Data Rights API (G-033, G-034, G-035, G-036, GDPR Art. 15, 16, 17, 20)
 *
 * FIXED H-B11-1: Session token was passed in GET query string (?token=X) — 
 *   this leaks tokens into server logs, browser history, and Referer headers.
 *   Now: All 3 endpoints authenticate via Authorization: Bearer <jwt> header.
 *
 * GET    /api/gdpr?email=X   — Article 15/20: data export (DSAR)
 * POST   /api/gdpr           — Article 16: request data correction
 * DELETE /api/gdpr?email=X   — Article 17: erasure ("right to be forgotten")
 */

const CorrectionSchema = z.object({
  email:       z.string().email(),
  corrections: z.record(z.string(), z.string()),
});

// ── GET /api/gdpr — Article 15/20: Data Export ────────────────────────────────
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "email required." }, { status: 400 });
    }

    // FIX H-B11-1: Authenticate via Bearer JWT — NOT query param token
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    // Verify the session owner matches the requested email
    if (session.email !== email) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const customer = await prisma.customer.findFirst({ where: { email } });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    }

    // Collect all personal data (Article 15 — Right of Access)
    const [orders, reviews, wishlists, loyaltyAccount, newsletterSub, abandonedCarts] = await Promise.all([
      prisma.order.findMany({ where: { customerId: customer.id }, include: { items: true } }),
      prisma.review.findMany({ where: { email } }),
      prisma.wishlistItem.findMany({ where: { email } }),
      (prisma as any).loyaltyAccount.findUnique({ where: { email } }),
      (prisma as any).newsletterSubscriber.findUnique({ where: { email } }),
      (prisma as any).abandonedCart.findMany({ where: { email } }),
    ]);

    const exportData = {
      exportedAt:   new Date().toISOString(),
      legalBasis:   "GDPR Article 15 — Right of Access / Article 20 — Data Portability",
      subject:      { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, address: customer.address, createdAt: customer.createdAt },
      orders:       orders.map(o => ({ id: o.id, status: o.status, total: o.total, items: o.items, createdAt: o.createdAt })),
      reviews:      reviews.map(r => ({ id: r.id, productId: r.productId, rating: r.rating, body: r.body, createdAt: r.createdAt })),
      wishlists:    wishlists.map(w => ({ productId: w.productId })),
      loyalty:      loyaltyAccount ? { points: loyaltyAccount.points, tier: loyaltyAccount.tier } : null,
      newsletter:   newsletterSub ? { confirmed: newsletterSub.confirmed } : null,
      abandonedCarts: abandonedCarts.length,
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type":        "application/json",
        "Content-Disposition": `attachment; filename="groceryos-data-${customer.id}-${Date.now()}.json"`,
        // Never cache GDPR exports
        "Cache-Control":       "no-store, no-cache",
      },
    });
  } catch {
    return NextResponse.json({ error: "Data export failed." }, { status: 500 });
  }
}

// ── DELETE /api/gdpr — Article 17: Right to Erasure ──────────────────────────
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "email required." }, { status: 400 });
    }

    // FIX H-B11-1: Bearer JWT authentication
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (session.email !== email) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const customer = await prisma.customer.findFirst({ where: { email } });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    }

    // Article 17 — Erasure: anonymise to preserve order financial integrity
    await prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: customer.id },
        data: {
          email:        `deleted-${customer.id}@anon.groceryos.internal`,
          name:         "Deleted User",
          phone:        `deleted-${customer.id}`,
          address:      "",
          passwordHash: null,
          sessionToken: null,
        },
      });
      await tx.review.deleteMany({ where: { email: customer.email ?? "" } });
      await tx.wishlistItem.deleteMany({ where: { email: customer.email ?? "" } });
      await (tx as any).loyaltyAccount.deleteMany({ where: { email } });
      await (tx as any).newsletterSubscriber.deleteMany({ where: { email } });
      await (tx as any).abandonedCart.deleteMany({ where: { email } });
      await (tx as any).mFAConfig.deleteMany({ where: { email } });
      await (tx as any).passwordReset.deleteMany({ where: { email } });
      await (tx as any).pushSubscription.deleteMany({ where: { email } });
    });

    return NextResponse.json({
      success:    true,
      message:    "Your personal data has been erased. Order records have been anonymised to maintain financial integrity.",
      legalBasis: "GDPR Article 17 — Right to Erasure",
    });
  } catch {
    return NextResponse.json({ error: "Data erasure failed." }, { status: 500 });
  }
}

// ── POST /api/gdpr — Article 16: Right to Rectification ──────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // FIX H-B11-1: Bearer JWT authentication
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const parsed = CorrectionSchema.safeParse(body);
    if (!parsed.success) {
      const msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { email, corrections } = parsed.data;

    // Verify JWT owner matches requested email
    if (session.email !== email) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const customer = await prisma.customer.findFirst({ where: { email } });
    if (!customer) return NextResponse.json({ error: "Customer not found." }, { status: 404 });

    const allowedFields = ["name", "phone", "address"];
    const update: Record<string, string> = {};
    for (const [k, v] of Object.entries(corrections)) {
      if (allowedFields.includes(k) && typeof v === "string" && v.length <= 500) {
        update[k] = v;
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No valid fields to update. Allowed: name, phone, address." }, { status: 400 });
    }

    const updated = await prisma.customer.update({ where: { id: customer.id }, data: update });
    return NextResponse.json({
      success: true,
      message: "Data corrected.",
      updated: { name: updated.name, phone: updated.phone, address: updated.address },
    });
  } catch {
    return NextResponse.json({ error: "Rectification failed." }, { status: 500 });
  }
}
