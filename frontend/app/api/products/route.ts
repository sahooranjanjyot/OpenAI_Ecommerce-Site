import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET() {
  try {
    const productsCount = await prisma.product.count();
    
    if (productsCount === 0) {
      await prisma.product.createMany({
        data: [
          { name: "Apple", category: "Fruits", price: 1.20, stock: 50, enabled: true, image: "", onSale: false, unit: "kg" },
          { name: "Banana", category: "Fruits", price: 0.90, stock: 40, enabled: true, image: "", onSale: false, unit: "kg" },
          { name: "Milk", category: "Dairy", price: 1.10, stock: 30, enabled: true, image: "", onSale: false, unit: "litre" },
          { name: "Potato Chips", category: "Snacks", price: 1.50, stock: 60, enabled: true, image: "", onSale: false, unit: "pack" },
          { name: "Orange Juice", category: "Beverages", price: 2.00, stock: 20, enabled: true, image: "", onSale: false, unit: "litre" },
        ]
      });
    }

    const products = await prisma.product.findMany();
    return NextResponse.json(products);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const product = await prisma.product.create({
      data: {
        name: body.name,
        category: body.category,
        price: body.price,
        wasPrice: body.wasPrice,
        onSale: body.onSale,
        stock: body.stock,
        unit: body.unit,
        image: body.image,
        description: body.description,
        enabled: body.enabled,
        hidden: body.hidden,
        featured: body.featured,
      },
    });
    return NextResponse.json(product);
  } catch (error) {
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    const product = await prisma.product.update({
      where: { id },
      data,
    });
    return NextResponse.json(product);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    
    await prisma.product.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}
