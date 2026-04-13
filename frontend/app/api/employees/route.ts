import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const employees = await prisma.employee.findMany();
    return NextResponse.json(employees);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId, name, password } = await req.json();
    if (!userId || !name || !password) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const existing = await prisma.employee.findUnique({ where: { userId } });
    if (existing) return NextResponse.json({ error: "User ID already exists." }, { status: 400 });

    const emp = await prisma.employee.create({
      data: { userId, name, password }
    });
    return NextResponse.json({ success: true, employee: emp });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = parseInt(url.searchParams.get("id") || "0");
    await prisma.employee.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { id, active, modules } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    const updateData: any = {};
    if (active !== undefined) updateData.active = active;
    if (modules !== undefined) updateData.modules = modules;

    const emp = await prisma.employee.update({
      where: { id },
      data: updateData
    });
    return NextResponse.json({ success: true, employee: emp });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

