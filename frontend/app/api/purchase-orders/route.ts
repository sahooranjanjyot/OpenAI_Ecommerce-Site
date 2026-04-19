import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const { productId, productName, suggestedQty, supplierName, unitCost, leadTimeDays } = await req.json();

    if (!productId || !suggestedQty) {
      return NextResponse.json({ error: "Missing required product or quantity." }, { status: 400 });
    }

    // Expected Delivery Date = Today + leadTimeDays
    const expected = new Date();
    expected.setDate(expected.getDate() + (leadTimeDays || 2));

    const po = await prisma.purchaseOrder.create({
      data: {
        productId: parseInt(productId),
        productName: productName,
        orderedQty: parseFloat(suggestedQty),
        supplier: supplierName || "Default Main Supplier",
        unitCost: parseFloat(unitCost || 0.0),
        status: "pending_delivery",
        expectedDate: expected
      }
    });

    return NextResponse.json({
      poId: String(po.id),
      productId: String(po.productId),
      productName: po.productName,
      orderedQty: po.orderedQty,
      supplier: po.supplier,
      expectedDate: po.expectedDate,
      status: po.status
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const pos = await prisma.purchaseOrder.findMany({
      orderBy: { createdAt: "desc" }
    });
    return NextResponse.json(pos);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
