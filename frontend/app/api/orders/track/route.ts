import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { requireAdmin } from "../../../lib/auth-middleware";
import { z } from "zod";

// ── GET /api/orders/track?orderId=X&phone=Y — public order tracking (G-025) ──
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = parseInt(searchParams.get("orderId") ?? "0", 10);
    const phone   = searchParams.get("phone");

    if (!orderId) return NextResponse.json({ error: "Order ID is required." }, { status: 400 });

    const order = await prisma.order.findUnique({
      where:   { id: orderId },
      include: { customer: { select: { name: true, phone: true } } },
    });

    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    // Verify ownership — customer must provide their phone (no admin token needed)
    if (phone && order.customer?.phone !== phone) {
      return NextResponse.json({ error: "Order details do not match. Please check your phone number." }, { status: 403 });
    }

    // Status timeline
    const statusFlow: Record<string, number> = {
      new: 1, processing: 2, dispatched: 3, delivered: 4,
    };
    const currentStep = statusFlow[order.status ?? "new"] ?? 1;

    const timeline = [
      { step: 1, label: "Order Placed",    done: currentStep >= 1 },
      { step: 2, label: "Processing",      done: currentStep >= 2 },
      { step: 3, label: "Out for Delivery", done: currentStep >= 3 },
      { step: 4, label: "Delivered",        done: currentStep >= 4 },
    ];

    return NextResponse.json({
      orderId:   order.id,
      status:    order.status,
      total:     order.total,
      address:   order.address,
      createdAt: order.createdAt,
      timeline,
      items:     JSON.parse(order.items as string),
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch order tracking." }, { status: 500 });
  }
}
