/**
 * lib/auth-middleware.ts
 * Shared admin auth guard for all protected API routes (G-002)
 *
 * FIX C-B1-1: Replaced non-constant-time string comparison with
 * crypto.timingSafeEqual() to prevent timing attacks.
 * FIX M-B1-4: Added RBAC role enum for future granular permissions.
 */
import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

export type AdminRole = "super_admin" | "admin" | "staff" | "readonly";

// Validate required secrets at module load time
const JWT_SECRET = process.env.JWT_SECRET;
const AUDIT_HMAC_SECRET = process.env.AUDIT_HMAC_SECRET;

if (!JWT_SECRET || !AUDIT_HMAC_SECRET) {
  throw new Error("AUDIT_HMAC_SECRET or JWT_SECRET env var required");
}

/**
 * Constant-time token comparison — prevents timing-based token enumeration.
 */
function safeTokenCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      // Still run a dummy compare to avoid length-timing leak
      timingSafeEqual(bufA, bufA);
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export function requireAdmin(req: Request): NextResponse | null {
  const token = req.headers.get("x-admin-token");
  const expected = process.env.ADMIN_API_TOKEN;

  if (!token || !expected || !safeTokenCompare(token, expected)) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }
  return null; // null = authorised, proceed
}

/**
 * Role-based guard — checks x-admin-role header against required role.
 * Roles in ascending privilege: readonly < staff < admin < super_admin
 */
const ROLE_LEVELS: Record<AdminRole, number> = {
  readonly:    1,
  staff:       2,
  admin:       3,
  super_admin: 4,
};

export function requireRole(req: Request, minRole: AdminRole): NextResponse | null {
  const adminCheck = requireAdmin(req);
  if (adminCheck) return adminCheck;

  const role = (req.headers.get("x-admin-role") ?? "admin") as AdminRole;
  if (!ROLE_LEVELS[role] || ROLE_LEVELS[role] < ROLE_LEVELS[minRole]) {
    return NextResponse.json(
      { error: `Insufficient permissions. Required: ${minRole}.` },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Session payload returned by getSession()
 */
export interface SessionPayload {
  userId:     string;
  customerId: number;
  email:      string;
  role?:      string;
  exp?:       number;
}

/**
 * Verify a customer JWT from the Authorization: Bearer <token> header.
 * Returns the decoded payload, or null if missing/invalid/expired.
 *
 * Used for customer-scoped endpoints (profile, GDPR, experiments).
 * Separate from requireAdmin() — uses JWT_SECRET not ADMIN_API_TOKEN.
 */
export async function getSession(req: Request): Promise<SessionPayload | null> {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return null;
    const token = authHeader.slice(7).trim();
    if (!token) return null;

    // JWT_SECRET is validated at module load, safe to use here
    const { jwtVerify } = await import("jose");
    const key    = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });

    if (!payload.sub || !payload.email) return null;

    return {
      userId:     String(payload.sub),
      customerId: Number(payload.customerId ?? 0),
      email:      String(payload.email),
      role:       payload.role ? String(payload.role) : undefined,
      exp:        payload.exp,
    };
  } catch {
    return null;
  }
}
