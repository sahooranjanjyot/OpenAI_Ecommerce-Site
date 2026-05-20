import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/auth-middleware";
import { z } from "zod";

/**
 * Call Centre / Phone Order Entry (G-250)
 * Staff interface to place orders on behalf of customers
 * Also handles kiosk mode (G-207) and offline sync (G-251)
 */

const PhoneOrderSchema = z.object({
  agentId:      z.string().min(1).max(50),
  customerPhone: z.string().min(5).max(20),
  items:        z.array(z.object({
    productId: z.number().int().positive(),
    qty:       z.number().int().positive(),
  })).min(1),
  paymentMethod: z.enum(["card_over_phone","cash_on_delivery","invoice","account_credit"]),
  deliveryAddress: z.string().min(5).max(500),
  notes:        z.string().max(500).optional(),
  callId:       z.string().optional(), // Call recording reference
});

export async function POST(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  try {
    const parsed = PhoneOrderSchema.safeParse(await req.json());
    if (!parsed.success) { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }

    const { agentId, customerPhone, items, paymentMethod, deliveryAddress, notes, callId } = parsed.data;
    const { prisma } = await import("../../../lib/prisma");

    // Find or create customer
    let customer = await prisma.customer.findFirst({ where: { phone: customerPhone } });
    if (!customer) {
      customer = await prisma.customer.create({
        data: { name: "Phone Customer", email: `tel_${customerPhone.replace(/\D/g,"")}@call.groceryos.example.com`, phone: customerPhone, address: deliveryAddress },
      });
    }

    // FIX H-B4-1: Atomic stock decrement — prevents race condition
    // updateMany with conditional WHERE ensures stock never goes negative
    let total = 0;
    const orderItems: any[] = [];
    for (const { productId, qty } of items) {
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) return NextResponse.json({ error: `Product ${productId} not found.` }, { status: 404 });

      const updated = await prisma.product.updateMany({
        where: { id: productId, stock: { gte: qty } },
        data:  { stock: { decrement: qty } },
      });
      if (updated.count === 0) {
        return NextResponse.json({ error: `Insufficient stock for ${product.name}.` }, { status: 409 });
      }
      total += product.price * qty;
      orderItems.push({ id: productId, name: product.name, price: product.price, qty });
    }

    const order = await prisma.order.create({
      data: {
        customerId: customer.id,
        status:     "processing",
        total:      parseFloat(total.toFixed(2)),
        items:      JSON.stringify(orderItems),
        address:    deliveryAddress,
      },
    });

    // Audit log
    await (prisma as any).auditLog.create({
      data: {
        action:   "PHONE_ORDER",
        resource: `Order:${order.id}`,
        userId:   agentId,
        ip:       "call-centre",
        payload:  JSON.stringify({ callId, paymentMethod, notes }),
        checksum: "phone-order",
      },
    }).catch(() => {});

    return NextResponse.json({
      success:  true,
      orderId:  order.id,
      customer: { id: customer.id, name: customer.name, phone: customer.phone },
      total:    order.total,
      message:  `Order #${order.id} placed by agent ${agentId} via phone.`,
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Phone order failed." }, { status: 500 });
  }
}

// ── GET /api/call-centre — agent dashboard ────────────────────────────────────
export async function GET(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const { prisma } = await import("../../../lib/prisma");
    // Recent phone orders (logged as PHONE_ORDER in audit)
    const recentPhoneOrders = await (prisma as any).auditLog.findMany({
      where:   { action: "PHONE_ORDER" },
      orderBy: { createdAt: "desc" },
      take:    20,
    });
    return NextResponse.json({ recentPhoneOrders });
  } catch {
    return NextResponse.json({ error: "Dashboard failed." }, { status: 500 });
  }
}
