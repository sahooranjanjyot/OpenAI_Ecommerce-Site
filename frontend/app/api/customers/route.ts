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
    const { id, notes, blocked } = body;
    const update = await prisma.customer.update({
      where: { id },
      data: { notes, blocked }
    });
    return NextResponse.json(update);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update Customer" }, { status: 500 });
  }
}
