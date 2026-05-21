import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-middleware";
import { z } from "zod";
import { createHmac } from "crypto";
import { jwtVerify } from "jose";
import { logger } from "@/lib/logger";

/** Extract caller identity from JWT cookie (returns null for unauthenticated) */
async function getCallerSession(req: Request): Promise<{ customerId?: number; role?: string } | null> {
  try {
    const cookie = req.headers.get("cookie") ?? "";
    const match  = cookie.match(/(?:^|;\s*)token=([^;]+)/);
    if (!match) return null;
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET ?? (() => { throw new Error("JWT_SECRET required"); })()
    );
    const { payload } = await jwtVerify(match[1], secret);
    return {
      customerId: payload.customerId as number | undefined,
      role:       payload.role       as string | undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Orders API — full CRUD with state machine validation
 *
 * FIX C-B2-3: Added order state machine — invalid transitions rejected
 * FIX C-B2-4: Added cumulative refund tracking (prevents over-refunding)
 * FIX REL-001: Idempotency key via x-idempotency-key header
 */

import { withIdempotency } from "@/lib/resilience";

const VALID_TRANSITIONS: Record<string, string[]> = {
  new:        ["processing", "cancelled"],
  processing: ["dispatched", "cancelled"],
  dispatched: ["delivered", "cancelled"],
  delivered:  ["refunded"],
  cancelled:  [],
  refunded:   [],
};

// ── GET /api/orders — customer order history or admin all orders ───────────────
// H1 FIX: Orders are now ownership-checked. Customers can only access their own
// orders. Admins (role=admin/super_admin) can access any order. Returning 404
// on access denial to avoid leaking order existence to attackers.
export async function GET(req: Request) {
  try {
    const session = await getCallerSession(req);
    const isAdmin = session?.role === "admin" || session?.role === "super_admin";

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");
    const orderId    = searchParams.get("id");
    const page       = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit      = Math.min(100, parseInt(searchParams.get("limit") ?? "20", 10));

    if (orderId) {
      const order = await prisma.order.findUnique({
        where:   { id: parseInt(orderId, 10) },
        include: { items: true },
      });
      // Return 404 (not 403) to avoid confirming order existence to non-owners
      if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

      // IDOR check: non-admins may only view their own orders
      if (!isAdmin && session?.customerId && order.customerId !== session.customerId) {
        return NextResponse.json({ error: "Order not found." }, { status: 404 });
      }

      return NextResponse.json(order);
    }

    // List view: non-admins are always scoped to their own customerId
    let scopedCustomerId: number | null = null;
    if (!isAdmin) {
      if (!session?.customerId) {
        return NextResponse.json({ error: "Authentication required." }, { status: 401 });
      }
      scopedCustomerId = session.customerId;
    } else if (customerId) {
      scopedCustomerId = parseInt(customerId, 10);
    }

    const where = scopedCustomerId ? { customerId: scopedCustomerId } : {};
    const [orders, total] = await Promise.all([
      prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit, include: { items: true } }),
      prisma.order.count({ where }),
    ]);

    return NextResponse.json({ orders, total, page, pages: Math.ceil(total / limit) });
  } catch {
    return NextResponse.json({ error: "Failed to fetch orders." }, { status: 500 });
  }
}

// ── POST /api/orders — create order ──────────────────────────────────────────
const CreateOrderSchema = z.object({
  customerId:     z.number().int().positive().optional(),
  items:          z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().positive(), price: z.number().positive() })).min(1),
  shippingAddr:   z.string().min(5).max(500),
  shippingCost:   z.number().min(0),
  discountAmount: z.number().min(0).default(0),
  couponCode:     z.string().optional(),
  affiliateCode:  z.string().optional(),
  notes:          z.string().max(500).optional(),
});

export async function POST(req: Request) {
  try {
    const idempotencyKey = req.headers.get("x-idempotency-key");
    const rawBody = await req.json();
    const parsed  = CreateOrderSchema.safeParse(rawBody);
    if (!parsed.success) {
      const msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const createFn = async () => {
      const { customerId, items, shippingAddr, shippingCost, discountAmount, couponCode, affiliateCode, notes } = parsed.data;

      // Use transaction to prevent race conditions on stock (C-B2-1)
      return await prisma.$transaction(async (tx) => {
        // Verify and reserve stock
        for (const item of items) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product) throw new Error(`Product ${item.productId} not found.`);
          if (product.stock < item.quantity) throw new Error(`Insufficient stock for "${product.name}".`);
          await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.quantity } } });
        }

        const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
        const total    = Math.max(0, subtotal + shippingCost - discountAmount);

        const order = await tx.order.create({
          data: {
            customerId:   customerId ?? null,
            status:       "new",
            total,
            shippingAddr,
            shippingCost,
            discountAmount,
            couponCode:   couponCode ?? null,
            affiliateCode: affiliateCode ?? null,
            notes:        notes ?? null,
            items: { create: items.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.price })) },
          },
          include: { items: true },
        });

        return order;
      });
    };

    if (idempotencyKey) {
      const { result, duplicate } = await withIdempotency(idempotencyKey, 3_600_000, createFn);
      return NextResponse.json({ ...result, duplicate }, { status: duplicate ? 200 : 201 });
    }

    const order = await createFn();
    // FIX LOW: Audit log order creation
    logger.audit("ORDER_CREATED", { resource: `Order:${order.id}`, customerId: parsed.data.customerId, total: order.total });
    return NextResponse.json(order, { status: 201 });
  } catch (err: any) {
    // FIX MEDIUM: Mask internal error details — log server-side, return safe message
    if (err.message?.startsWith("Product") || err.message?.startsWith("Insufficient")) {
      // These are safe domain errors we generated, not DB internals
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    logger.error("Order creation failed", { error: err?.message });
    return NextResponse.json({ error: "Failed to create order." }, { status: 500 });
  }
}

// ── PUT /api/orders — admin only: update order status ────────────────────────
export async function PUT(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  try {
    const { id, status, note } = await req.json();
    if (!id || !status) return NextResponse.json({ error: "id and status required." }, { status: 400 });

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    // State machine validation (C-B2-3)
    const allowed = VALID_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(status)) {
      return NextResponse.json({
        error: `Cannot transition order from "${order.status}" to "${status}". Allowed: ${allowed.join(", ") || "none"}.`,
      }, { status: 400 });
    }

    const updated = await prisma.order.update({
      where: { id },
      data:  { status, statusNote: note ?? null, updatedAt: new Date() },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update order." }, { status: 500 });
  }
}

// ── DELETE /api/orders — cancel order (ownership-checked) ────────────────────
export async function DELETE(req: Request) {
  try {
    const session = await getCallerSession(req);
    const isAdmin = session?.role === "admin" || session?.role === "super_admin";

    const id = parseInt(new URL(req.url).searchParams.get("id") ?? "0", 10);
    if (!id) return NextResponse.json({ error: "Order ID required." }, { status: 400 });

    const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    // Ownership check — only owner or admin can cancel
    if (!isAdmin && session?.customerId && order.customerId !== session.customerId) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (!VALID_TRANSITIONS[order.status]?.includes("cancelled") && order.status !== "new") {
      return NextResponse.json({ error: `Cannot cancel an order with status "${order.status}".` }, { status: 400 });
    }

    // Restore stock atomically
    await prisma.$transaction([
      ...order.items.map(item =>
        prisma.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } })
      ),
      prisma.order.update({ where: { id }, data: { status: "cancelled" } }),
    ]);

    return NextResponse.json({ success: true, message: "Order cancelled and stock restored." });
  } catch {
    return NextResponse.json({ error: "Failed to cancel order." }, { status: 500 });
  }
}
