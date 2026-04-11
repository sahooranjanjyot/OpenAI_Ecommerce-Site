import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function POST(req: Request) {
  try {
    const { orderId, productName, quantity, reason, condition, refundAmount, restocked, processedBy } = await req.json();

    if (!orderId || !productName || !quantity) {
      return NextResponse.json({ error: "Missing return payload requirements" }, { status: 400 });
    }

    // Process the return trace
    const r = await prisma.return.create({
      data: {
        orderId: parseInt(orderId),
        productName,
        quantity: parseInt(quantity),
        reason,
        condition,
        refundAmount: parseFloat(refundAmount) || 0,
        restocked: Boolean(restocked),
        processedBy,
      }
    });

    // Handle Inventory Traces: Physical Restock
    if (Boolean(restocked)) {
       // Locate physical product by exact name dynamically
       const targetProduct = await prisma.product.findFirst({
         where: { name: productName }
       });
       if (targetProduct) {
         await prisma.product.update({
           where: { id: targetProduct.id },
           data: { stock: { increment: parseInt(quantity) } }
         });
       }
    }

    return NextResponse.json({ success: true, returnRecord: r });
  } catch (error) {
    console.error("RETURN SUBMISSION ERROR:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function GET() {
  try {
     const data = await prisma.return.findMany({ include: { order: true } });
     return NextResponse.json(data || []);
  } catch(error) {
     return NextResponse.json({ error: "Failed to fetch Returns" }, { status: 500 });
  }
}
