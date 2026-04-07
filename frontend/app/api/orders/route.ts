import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET() {
  try {
    const data = await prisma.order.findMany({ include: { customer: true } });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch Orders" }, { status: 500 });
  }
}
