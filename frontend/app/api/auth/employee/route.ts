import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const { userId, password } = await req.json();
    
    const emp = await prisma.employee.findUnique({ where: { userId } });
    if (!emp) return NextResponse.json({ error: "Invalid Employee ID" }, { status: 401 });
    if (emp.password !== password) return NextResponse.json({ error: "Invalid Passcode" }, { status: 401 });
    if (!emp.active) return NextResponse.json({ error: "Employee account disabled." }, { status: 403 });

    return NextResponse.json({ success: true, user: emp });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
