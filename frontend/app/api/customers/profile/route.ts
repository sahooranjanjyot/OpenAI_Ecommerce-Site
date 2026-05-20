import { NextResponse } from "next/server";
import { requireAdmin, getSession } from "../../../lib/auth-middleware";
import { z } from "zod";

/**
 * Customer Data Platform (G-194)
 *
 * FIXED H-B8-1: Authorization bypass via email parameter.
 *   Before: GET ?email=victim@example.com returned any customer's full PII profile.
 *   After:  Non-admin callers can only access their OWN profile (verified via JWT session).
 *           Admins may access any profile by email/phone.
 */

const ProfileQuerySchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(5).max(20).optional(),
});

// ── GET /api/customers/profile?email=X ────────────────────────────────────────
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email   = searchParams.get("email")  ?? undefined;
    const phone   = searchParams.get("phone")  ?? undefined;
    const authErr = requireAdmin(req);
    const isAdmin = !authErr;

    if (!email && !phone) {
      return NextResponse.json({ error: "email or phone required." }, { status: 400 });
    }

    const parsed = ProfileQuerySchema.safeParse({ email, phone });
    if (!parsed.success) {
      const msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { prisma } = await import("../../../lib/prisma");

    // Find customer
    const customer = email
      ? await prisma.customer.findFirst({ where: { email } })
      : await prisma.customer.findFirst({ where: { phone: phone! } });

    if (!customer) return NextResponse.json({ error: "Customer not found." }, { status: 404 });

    // FIX H-B8-1: Non-admin can only access their OWN profile
    if (!isAdmin) {
      const session = await getSession(req);
      if (!session) {
        return NextResponse.json({ error: "Authentication required." }, { status: 401 });
      }
      // Verify the session belongs to this customer
      if (session.customerId !== customer.id) {
        // Return 404 not 403 — prevents existence enumeration
        return NextResponse.json({ error: "Customer not found." }, { status: 404 });
      }
    }

    const [orders, loyalty, subscriptions, newsletter, wishlist, tickets] = await Promise.all([
      prisma.order.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: "desc" }, take: 10 }),
      (prisma as any).loyaltyAccount.findUnique({ where: { email: customer.email } }),
      (prisma as any).subscription.findMany({ where: { email: customer.email, active: true } }),
      (prisma as any).newsletterSubscription.findUnique({ where: { email: customer.email } }),
      (prisma as any).wishlistItem.findMany({ where: { email: customer.email } }),
      (prisma as any).supportTicket.findMany({ where: { email: customer.email }, take: 5 }),
    ]);

    // CLV / RFM calculation
    const totalSpend    = orders.reduce((s: number, o: any) => s + (o.total ?? 0), 0);
    const avgOrderValue = orders.length > 0 ? totalSpend / orders.length : 0;
    const orderCount    = orders.length;
    const latestOrder   = orders[0];
    const daysSinceLast = latestOrder
      ? Math.floor((Date.now() - new Date(latestOrder.createdAt).getTime()) / 86400000)
      : 999;

    const recency   = daysSinceLast <= 7 ? 5 : daysSinceLast <= 30 ? 4 : daysSinceLast <= 90 ? 3 : daysSinceLast <= 180 ? 2 : 1;
    const frequency = orderCount >= 20 ? 5 : orderCount >= 10 ? 4 : orderCount >= 5 ? 3 : orderCount >= 2 ? 2 : 1;
    const monetary  = totalSpend >= 500 ? 5 : totalSpend >= 200 ? 4 : totalSpend >= 100 ? 3 : totalSpend >= 50 ? 2 : 1;
    const rfmScore  = recency + frequency + monetary;
    const segment   = rfmScore >= 12 ? "Champion" : rfmScore >= 9 ? "Loyal" : rfmScore >= 6 ? "At Risk" : "Needs Attention";

    // Strip sensitive fields from customer object
    const { password: _pw, passwordHash: _ph, sessionToken: _st, ...safeCustomer } = customer as any;

    return NextResponse.json({
      customer: safeCustomer,
      profile: {
        totalSpend:          parseFloat(totalSpend.toFixed(2)),
        avgOrderValue:       parseFloat(avgOrderValue.toFixed(2)),
        orderCount,
        daysSinceLastOrder:  daysSinceLast,
        rfm:                 { recency, frequency, monetary, score: rfmScore, segment },
        loyaltyTier:         loyalty?.points >= 5000 ? "Gold" : loyalty?.points >= 1000 ? "Silver" : "Standard",
        loyaltyPoints:       loyalty?.points ?? 0,
        activeSubscriptions: subscriptions.length,
        wishlistItems:       wishlist.length,
        newsletterOptIn:     newsletter?.subscribed ?? false,
        openTickets:         tickets.filter((t: any) => t.status !== "resolved").length,
      },
      recentOrders: orders.slice(0, 5),
    });
  } catch {
    return NextResponse.json({ error: "Failed to build profile." }, { status: 500 });
  }
}
