import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET() {
  try {
    const data = await prisma.promo.findMany();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch Promos" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = await prisma.promo.create({
      data: {
        type: body.type,
        target: body.target,
        start: body.start,
        end: body.end,
        active: body.active,
      },
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Failed to create Promo" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    const update = await prisma.promo.update({
      where: { id },
      data,
    });
    return NextResponse.json(update);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update Promo" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    
    await prisma.promo.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete promo" }, { status: 500 });
  }
}
