import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-middleware";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Prisma } from "@prisma/client";

// ── Validation ────────────────────────────────────────────────────────────────
const CreateEmployeeSchema = z.object({
  userId:   z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/, "UserID: alphanumeric only"),
  name:     z.string().min(1).max(200),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role:     z.string().optional().default("cashier"),
});

const UpdateEmployeeSchema = z.object({
  userId:   z.string().min(3).max(50),
  name:     z.string().min(1).max(200).optional(),
  password: z.string().min(8).optional(),
  role:     z.string().optional(),
  pin:      z.string().length(4).regex(/^\d{4}$/).optional(),
  active:   z.boolean().optional(),
});

// ── GET — admin only ──────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const employees = await prisma.employee.findMany({
      orderBy: { name: "asc" },
    });
    // Never return passwords (G-001)
    const safe = employees.map(({ password: _pw, pin: _pin, ...e }) => e);
    return NextResponse.json(safe);
  } catch {
    return NextResponse.json({ error: "Failed to fetch employees." }, { status: 500 });
  }
}

// ── POST — admin only: create employee with hashed password (G-001) ───────────
export async function POST(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const raw    = await req.json();
    const parsed = CreateEmployeeSchema.safeParse(raw);
    if (!parsed.success) {
      { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }
    }
    const { userId, name, password, role } = parsed.data;

    const existing = await prisma.employee.findUnique({ where: { userId } });
    if (existing) {
      return NextResponse.json({ error: "User ID already exists." }, { status: 400 });
    }

    // Hash password with bcrypt (G-001)
    const hashedPassword = await bcrypt.hash(password, 12);
    // Using Prisma.EmployeeCreateInput would be ideal, but schema may vary; cast needed for dynamic role field
    const employee = await prisma.employee.create({
      data: { userId, name, password: hashedPassword, role } as Prisma.EmployeeCreateInput,
    });

    // Destructure to omit sensitive fields; employee type from Prisma includes all fields
    const { password: _pw, pin: _pin, ...safe } = employee;
    return NextResponse.json(safe, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create employee." }, { status: 500 });
  }
}

// ── PUT — admin only: update employee ────────────────────────────────────────
export async function PUT(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const raw    = await req.json();
    const parsed = UpdateEmployeeSchema.safeParse(raw);
    if (!parsed.success) {
      { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }
    }
    const { userId, password, ...rest } = parsed.data;

    // Using Prisma.EmployeeUpdateInput for type safety where possible
    const updateData: Prisma.EmployeeUpdateInput = { ...rest };
    if (password) {
      updateData.password = await bcrypt.hash(password, 12);
    }

    const employee = await prisma.employee.update({ where: { userId }, data: updateData });
    // Destructure to omit sensitive fields; employee type from Prisma includes all fields
    const { password: _pw, pin: _pin, ...safe } = employee;
    return NextResponse.json(safe);
  } catch (err) {
    // Handle Prisma P2025 error (record not found)
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Employee not found." }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update employee." }, { status: 500 });
  }
}

// ── DELETE — admin only ───────────────────────────────────────────────────────
export async function DELETE(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    if (!userId) return NextResponse.json({ error: "userId is required." }, { status: 400 });

    await prisma.employee.delete({ where: { userId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    // Handle Prisma P2025 error (record not found) and return 404 instead of 500
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Employee not found." }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete employee." }, { status: 500 });
  }
}
