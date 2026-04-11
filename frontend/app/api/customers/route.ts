import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET() {
  try {
    const data = await prisma.customer.findMany({ include: { Order: true } });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch Customers" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, notes, blocked, name, email, phone } = body;
    
    if (email) {
      const eCheck = await prisma.customer.findUnique({ where: { email } });
      if (eCheck && eCheck.id !== id) return NextResponse.json({ error: "Email strictly historically locked internally to another secure profile." }, { status: 400 });
    }
    if (phone) {
      const pCheck = await prisma.customer.findUnique({ where: { phone } });
      if (pCheck && pCheck.id !== id && pCheck.email) return NextResponse.json({ error: "Phone number safely already globally registered bound to another identity." }, { status: 400 });
    }

    const mapData: any = {};
    if (notes !== undefined) mapData.notes = notes;
    if (blocked !== undefined) mapData.blocked = blocked;
    if (name !== undefined) mapData.name = name;
    if (email !== undefined) mapData.email = email;
    if (phone !== undefined) mapData.phone = phone;

    const update = await prisma.customer.update({
      where: { id },
      data: mapData
    });
    return NextResponse.json(update);
  } catch (error) {
    return NextResponse.json({ error: "Failed to securely override structural Customer bounds natively" }, { status: 500 });
  }
}
