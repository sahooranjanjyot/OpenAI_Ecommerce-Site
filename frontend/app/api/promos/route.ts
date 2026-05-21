import { requireAdmin } from "@/lib/auth-middleware";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // PriceRule is the schema model for promotions/discounts
    const data = await prisma.priceRule.findMany({ where: { active: true } });
    return NextResponse.json(data);
  } catch (error) {
    // Return empty array — non-fatal, promos are optional
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const body = await req.json();
    const data = await prisma.priceRule.create({
      data: {
        name:     body.name || "Promo Rule",
        type:     body.type || "clearance",
        target:   body.target || "all",
        discount: body.discount ? parseFloat(body.discount) : 0,
        minQty:   body.buyX ? parseInt(body.buyX, 10) : 1,
        startAt:  body.start ? new Date(body.start) : null,
        endAt:    body.end ? new Date(body.end) : null,
        active:   body.active !== false,
      },
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Failed to create Promo" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const body = await req.json();
    const { id, ...rest } = body;
    const data: any = {};
    if (rest.name !== undefined) data.name = rest.name;
    if (rest.type !== undefined) data.type = rest.type;
    if (rest.target !== undefined) data.target = rest.target;
    if (rest.discount !== undefined) data.discount = parseFloat(rest.discount);
    if (rest.buyX !== undefined) data.minQty = parseInt(rest.buyX, 10);
    if (rest.start !== undefined) data.startAt = rest.start ? new Date(rest.start) : null;
    if (rest.end !== undefined) data.endAt = rest.end ? new Date(rest.end) : null;
    if (rest.active !== undefined) data.active = !!rest.active;

    const update = await prisma.priceRule.update({
      where: { id },
      data,
    });
    return NextResponse.json(update);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update Promo" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    
    await prisma.priceRule.delete({ where: { id: parseInt(id, 10) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete promo" }, { status: 500 });
  }
}
