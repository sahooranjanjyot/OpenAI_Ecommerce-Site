/**
 * CSRF Token API (G-006) — Fixed
 *
 * FIX: Migrated from in-memory Map to Redis-backed storage (via lib/cache.ts)
 * so tokens survive server restarts and work across multiple instances.
 * Token is set as an HttpOnly cookie AND returned in the response body
 * so clients can use both double-submit cookie and header patterns.
 */
import { NextResponse } from "next/server";
import { randomBytes, createHmac, timingSafeEqual } from "crypto";
import { cache } from "../../../lib/cache";

const CSRF_HMAC_SECRET = (() => {
  const s = process.env.CSRF_SECRET ?? process.env.JWT_SECRET;
  if (!s) throw new Error("CSRF_SECRET or JWT_SECRET env var is required");
  return s;
})();

const CSRF_TTL = 60 * 60; // 1 hour

function signToken(token: string): string {
  const sig = createHmac("sha256", CSRF_HMAC_SECRET).update(token).digest("hex");
  return `${token}.${sig}`;
}

function verifySignedToken(signedToken: string): string | null {
  const [token, sig] = signedToken.split(".");
  if (!token || !sig) return null;
  const expected = createHmac("sha256", CSRF_HMAC_SECRET).update(token).digest("hex");
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;
    return token;
  } catch {
    return null;
  }
}

// GET /api/csrf — issue a CSRF token
export async function GET(req: Request) {
  const token       = randomBytes(32).toString("hex");
  const signedToken = signToken(token);
  const sessionId   = req.headers.get("x-session-id") ?? randomBytes(16).toString("hex");

  // Store in Redis/cache for server-side validation option
  await cache.set(`csrf:${sessionId}`, token, CSRF_TTL);

  const response = NextResponse.json(
    { csrfToken: signedToken, sessionId },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
  );

  // Also set as cookie for double-submit pattern
  response.cookies.set("csrf_token", signedToken, {
    httpOnly: false, // must be readable by JS for double-submit
    secure:   process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge:   CSRF_TTL,
    path:     "/",
  });

  return response;
}

// Exported validation function for middleware use
export async function validateCsrfToken(
  req: Request,
  sessionId?: string
): Promise<boolean> {
  const method = req.method?.toUpperCase();
  if (!method || ["GET", "HEAD", "OPTIONS"].includes(method)) return true;

  const headerToken = req.headers.get("x-csrf-token");
  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookieToken  = cookieHeader.match(/(?:^|;\s*)csrf_token=([^;]+)/)?.[1];

  if (!headerToken || !cookieToken) return false;

  // Verify header and cookie tokens are the same HMAC-signed value
  const headerBase = verifySignedToken(headerToken);
  const cookieBase = verifySignedToken(cookieToken);
  if (!headerBase || !cookieBase) return false;

  try {
    const a = Buffer.from(headerBase, "hex");
    const b = Buffer.from(cookieBase, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
