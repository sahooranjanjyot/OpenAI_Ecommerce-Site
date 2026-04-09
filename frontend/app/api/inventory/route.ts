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
    const batch = await prisma.inventoryBatch.create({
      data: {
        productId: parseInt(body.productId),
        quantity: parseInt(body.quantity),
        remaining: parseInt(body.quantity),
        costPrice: parseFloat(body.costPrice),
        supplier: body.supplier || ""
      },
      include: { product: true }
    });

    // Also strictly update the total product stock automatically
    await prisma.product.update({
      where: { id: parseInt(body.productId) },
      data: { stock: { increment: parseInt(body.quantity) } }
    });

    return NextResponse.json(batch);
  } catch (error) {
    console.error("INVENTORY BATCH POST ERROR:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create inventory batch" }, { status: 500 });
  }
}
