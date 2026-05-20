import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { SignJWT } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? (() => { throw new Error("JWT_SECRET env var is required"); })()
);

/**
 * POST /api/auth/employee
 * Employee login — bcrypt password verification (C1 fix: no plaintext comparison)
 * Returns a short-lived JWT scoped to the employee's role.
 */
export async function POST(req: Request) {
  try {
    const { userId, password } = await req.json();

    if (!userId || !password || typeof userId !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 400 });
    }

    // Fetch employee from DB
    const emp = await prisma.employee.findUnique({ where: { userId } } as any);

    // Use constant-time comparison path: always run bcrypt even if user not found
    // to prevent timing-based user enumeration
    const dummyHash = "$2a$12$invalidhashfortimingnormalization000000000000000000000000";
    const storedHash = (emp as any)?.password ?? dummyHash;

    const passwordValid = await bcrypt.compare(password, storedHash);

    if (!emp || !passwordValid) {
      return NextResponse.json({ error: "Invalid Employee ID or Passcode." }, { status: 401 });
    }

    if (!(emp as any).active) {
      return NextResponse.json({ error: "Employee account is disabled." }, { status: 403 });
    }

    // Issue JWT scoped to employee role (8-hour expiry)
    const token = await new SignJWT({
      sub:    (emp as any).userId,
      role:   (emp as any).role ?? "cashier",
      type:   "employee",
      jti:    crypto.randomUUID(),
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("8h")
      .sign(JWT_SECRET);

    // Strip sensitive fields from response
    const { password: _pw, pin: _pin, ...safeEmp } = emp as any;

    const response = NextResponse.json({ success: true, user: safeEmp });
    response.cookies.set("emp_token", token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge:   8 * 60 * 60,
      path:     "/",
    });
    return response;

  } catch (err: any) {
    console.error("[EMPLOYEE AUTH ERROR]", err.message);
    return NextResponse.json({ error: "Authentication failed." }, { status: 500 });
  }
}
