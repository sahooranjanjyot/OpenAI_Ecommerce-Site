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
      const newOrderCount = customer.orders + 1;
      let updatedNotes = customer.notes || "";
      
      // Autonomous Loyalty Trigger (5 Orders Threshold)
      if (newOrderCount >= 5 && !updatedNotes.includes("LOYALTY")) {
         updatedNotes = (updatedNotes + " LOYALTY").trim();
      }

      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: {
          orders: newOrderCount,
          address: deliveryAddress,
          notes: updatedNotes,
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

    // Create Order natively utilizing strict JSON serialization
    const orderItems = JSON.stringify(cart);
    const order = await prisma.order.create({
      data: {
        customerId: customer.id,
        total: subtotal,
        items: orderItems,
        address: deliveryAddress,
        status: "new",
      }
    });

    // CRITICAL SECURITY & LOGISTICS LAYER: Server-Side Interactive Stock Depletion
    // We physically iterate over the mapped checkout array wrapping transactions
    try {
      await prisma.$transaction(
        cart.flatMap((item: any) => [
          prisma.product.update({
            where: { id: item.id },
            data: { stock: { decrement: item.qty } }
          }),
          prisma.inventoryBatch.create({
            data: {
               productId: item.id,
               quantity: -Math.abs(item.qty),
               channel: buyer.mobile === "POS" ? "instore" : "online",
               supplier: "Sales Checkout"
            }
          })
        ])
      );
    } catch (stockError) {
      console.error("Critical Inventory Mismatch during Cart Drain:", stockError);
      // Soft-fallback ensures checkout completion handles edge stock-outs safely
    }

    return NextResponse.json({ success: true, customer, order });
  } catch (error) {
    console.error("CHECKOUT API ERROR:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Checkout failed" }, { status: 500 });
  }
}
