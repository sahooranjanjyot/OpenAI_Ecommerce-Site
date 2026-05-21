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

/**
 * Synchronous JWT verification helper.
 * Uses native crypto module to verify HS256 JWT signature in constant time.
 */
function verifyHS256Sync(token: string, secret: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;

    // Recalculate signature using HMAC-SHA256
    const { createHmac } = require("crypto");
    const hmac = createHmac("sha256", secret);
    hmac.update(`${headerB64}.${payloadB64}`);
    const expectedSignatureB64 = hmac.digest("base64url");

    // Constant-time signature comparison to prevent timing attacks
    if (!safeTokenCompare(signatureB64, expectedSignatureB64)) {
      return null;
    }

    // Decode and parse payload
    const payloadStr = Buffer.from(payloadB64, "base64url").toString("utf8");
    const payload = JSON.parse(payloadStr);

    // Validate expiration
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * requireAuth - Guard endpoint and retrieve authenticated user synchronously or asynchronously.
 * Returns an object with user details if authenticated, or NextResponse (401 Unauthorized) if not.
 * Supports flat destructuring (e.g. auth.email) and nested user (e.g. auth.user.email) usages.
 */
export function requireAuth(req: Request): any {
  const authHeader = req.headers.get("authorization") ?? "";
  let token = "";
  if (authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  } else {
    const cookie = req.headers.get("cookie") ?? "";
    const match = cookie.match(/(?:^|;\s*)token=([^;]+)/);
    if (match) token = match[1];
  }

  if (!token) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const payload = verifyHS256Sync(token, JWT_SECRET ?? "");
  if (!payload || !payload.sub || !payload.email) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const userObj = {
    id: String(payload.sub),
    email: String(payload.email),
    customerId: Number(payload.customerId ?? 0),
    b2bAccountId: payload.b2bAccountId ? Number(payload.b2bAccountId) : undefined,
  };

  return {
    ...userObj,
    user: userObj,
  };
}

/**
 * getAuthUser - Asynchronously retrieves the authenticated user's profile.
 * Returns the user profile object or null if unauthenticated.
 */
export async function getAuthUser(req: Request): Promise<any | null> {
  const authHeader = req.headers.get("authorization") ?? "";
  let token = "";
  if (authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  } else {
    const cookie = req.headers.get("cookie") ?? "";
    const match = cookie.match(/(?:^|;\s*)token=([^;]+)/);
    if (match) token = match[1];
  }

  if (!token) return null;

  const payload = verifyHS256Sync(token, JWT_SECRET ?? "");
  if (!payload || !payload.sub || !payload.email) return null;

  return {
    id: String(payload.sub),
    email: String(payload.email),
    customerId: Number(payload.customerId ?? 0),
    b2bAccountId: payload.b2bAccountId ? Number(payload.b2bAccountId) : undefined,
  };
}

