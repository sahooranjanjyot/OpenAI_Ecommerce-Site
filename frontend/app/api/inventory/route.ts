import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET(req: Request) {
  try {
    const batches = await prisma.inventoryBatch.findMany({
      include: {
        product: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(batches);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch inventory batches" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let pId = body.productId ? parseInt(body.productId) : null;
    
    // Architecturally orchestrate Just-In-Time Product Creation natively!
    if (!pId && body.productName && body.category) {
       const newP = await prisma.product.create({
          data: {
             name: body.productName,
             category: body.category,
             price: 0,
             stock: 0,
             unit: "Unit",
             enabled: true,
             hidden: false,
             featured: false,
             image: "",
             promo: "",
             description: ""
          }
       });
       pId = newP.id;
    }
    
    if (!pId) throw new Error("Product identity strictly unresolvable.");

    const batch = await prisma.inventoryBatch.create({
      data: {
        productId: pId,
        quantity: parseInt(body.quantity),
        remaining: parseInt(body.quantity),
        costPrice: parseFloat(body.costPrice),
        supplier: body.supplier || ""
      },
      include: { product: true }
    });

    // Also strictly update the total product stock automatically
    await prisma.product.update({
      where: { id: pId },
      data: { stock: { increment: parseInt(body.quantity) } }
    });

    return NextResponse.json(batch);
  } catch (error) {
    console.error("INVENTORY BATCH POST ERROR:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create inventory batch" }, { status: 500 });
  }
}
