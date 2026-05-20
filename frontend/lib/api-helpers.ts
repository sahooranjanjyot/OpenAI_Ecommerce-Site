/**
 * lib/api-helpers.ts
 *
 * Shared helpers to fix MEDIUM issues across all routes:
 *
 * M-1:  parsePagination()   — safe pagination defaults (max 100, min 1)
 * M-2:  parseDateRange()    — safe date range validation
 * M-3:  safeError()         — never leak internal error details to client
 * M-4:  requireOwnership()  — generic ownership check for IDOR prevention
 * M-5:  validateCsrfToken() — CSRF double-submit cookie validation
 */

import { NextResponse } from "next/server";
import { timingSafeEqual, createHmac } from "crypto";

// ── M-1: Pagination with safe defaults ───────────────────────────────────────
export interface PaginationParams {
  page:  number;
  limit: number;
  skip:  number;
}

export function parsePagination(
  searchParams: URLSearchParams,
  defaultLimit = 20,
  maxLimit = 100
): PaginationParams {
  const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(searchParams.get("limit") ?? String(defaultLimit), 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

// ── M-2: Date range validation ────────────────────────────────────────────────
export interface DateRange {
  gte?: Date;
  lte?: Date;
}

export function parseDateRange(searchParams: URLSearchParams): DateRange | null {
  const from = searchParams.get("from");
  const to   = searchParams.get("to");
  if (!from && !to) return null;
  const range: DateRange = {};
  if (from) {
    const d = new Date(from);
    if (isNaN(d.getTime())) return null;
    range.gte = d;
  }
  if (to) {
    const d = new Date(to);
    if (isNaN(d.getTime())) return null;
    range.lte = d;
  }
  return range;
}

// ── M-3: Safe error responses — never expose internal details ─────────────────
export function safeError(err: unknown, message = "An error occurred.", status = 500): NextResponse {
  const detail = err instanceof Error ? err.message : String(err);
  // Log server-side (structured)
  console.error(`[API ERROR] ${message}`, { detail, stack: err instanceof Error ? err.stack : undefined });
  // Return generic message to client
  return NextResponse.json({ error: message }, { status });
}

// ── M-4: Ownership check — returns 404 on failure (no existence leak) ─────────
export function assertOwnership(
  resourceOwnerId: number | null | undefined,
  callerId: number | null | undefined,
  isAdmin: boolean
): NextResponse | null {
  if (isAdmin) return null; // admins bypass
  if (!callerId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (resourceOwnerId !== callerId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 }); // 404, not 403
  }
  return null;
}

// ── M-5: CSRF double-submit cookie validation ─────────────────────────────────
const CSRF_HMAC_SECRET = process.env.CSRF_SECRET ?? process.env.JWT_SECRET ?? "fallback-csrf-key";

export function verifyCsrfToken(req: Request): boolean {
  // Skip for GET/HEAD/OPTIONS — these must be safe/idempotent methods
  const method = req.method?.toUpperCase();
  if (!method || ["GET", "HEAD", "OPTIONS"].includes(method)) return true;

  const headerToken = req.headers.get("x-csrf-token");
  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookieToken  = cookieHeader.match(/(?:^|;\s*)csrf_token=([^;]+)/)?.[1];

  if (!headerToken || !cookieToken) return false;

  // Both must exist and match (double-submit pattern)
  try {
    const a = Buffer.from(headerToken, "utf8");
    const b = Buffer.from(cookieToken,  "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function requireCsrf(req: Request): NextResponse | null {
  if (!verifyCsrfToken(req)) {
    return NextResponse.json({ error: "Invalid or missing CSRF token." }, { status: 403 });
  }
  return null;
}

// ── Generate a CSRF token (for the /api/csrf endpoint) ───────────────────────
export function generateCsrfToken(): string {
  const { randomBytes } = require("crypto") as typeof import("crypto");
  const token = randomBytes(32).toString("hex");
  // Sign with HMAC so we can detect tampering even without session
  const sig = createHmac("sha256", CSRF_HMAC_SECRET).update(token).digest("hex");
  return `${token}.${sig}`;
}

// ── Sanitize string for safe HTML embedding ───────────────────────────────────
export function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// ── Strip undefined keys from objects (cleaner Prisma data) ──────────────────
export function stripUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}
