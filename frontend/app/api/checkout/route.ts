import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function POST(req: Request) {
  try {
    const { buyer, cart, deliveryAddress, deliveryComment, subtotal } = await req.json();

    // Find or create customer
    let customer = await prisma.customer.findUnique({
      where: { phone: buyer.mobile }
    });

    if (customer) {
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: {
          orders: customer.orders + 1,
          address: deliveryAddress,
        }
      });
    } else {
      customer = await prisma.customer.create({
        data: {
          name: buyer.name,
          phone: buyer.mobile,
          address: deliveryAddress,
          orders: 1,
          notes: deliveryComment || "",
          blocked: false,
        }
      });
    }

    // Create Order
    const orderItems = cart.map((c: any) => `${c.name} x${c.qty}`).join(", ");
    const order = await prisma.order.create({
      data: {
        customerId: customer.id,
        total: subtotal,
        items: orderItems,
        address: deliveryAddress,
        status: "new",
      }
    });

    return NextResponse.json({ success: true, customer, order });
  } catch (error) {
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
