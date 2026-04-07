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
