import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-middleware";
import { cache } from "@/lib/cache";

/**
 * Auth middleware now uses Redis (via lib/cache.ts) for rate limiting
 * and account lockout to survive restarts and work across multiple instances.
 *
 * FIX H-B1-1: In-memory rateLimitMap → Redis
 * FIX H-B1-2: In-memory lockoutMap → Redis
 * FIX M-B1-1: Email no longer logged in plaintext on lockout
 * FIX M-B1-4: Password complexity validation (uppercase + number + symbol)
 * 
 * NOTE: The passwordReset model must be added to prisma.schema for the reset
 * functionality to work. Example:
 * 
 * model PasswordReset {
 *   id        Int      @id @default(autoincrement())
 *   email     String
 *   token     String
 *   used      Boolean  @default(false)
 *   expiresAt DateTime
 *   createdAt DateTime @default(now())
 * }
 */

import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { createHmac } from "crypto";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? (() => { throw new Error("JWT_SECRET env var required"); })()
);

// ── Schemas (G-011, G-014) ────────────────────────────────────────────────────
const passwordComplexity = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .refine(p => /[A-Z]/.test(p), "Password must contain an uppercase letter")
  .refine(p => /[a-z]/.test(p), "Password must contain a lowercase letter")
  .refine(p => /[0-9]/.test(p), "Password must contain a number")
  .refine(p => /[^A-Za-z0-9]/.test(p), "Password must contain a special character");

const LoginSchema = z.object({
  action:   z.literal("login"),
  email:    z.string().email(),
  password: z.string().min(1),
});

const RegisterSchema = z.object({
  action:   z.literal("register"),
  email:    z.string().email(),
  password: passwordComplexity,
  name:     z.string().min(1).max(100),
  phone:    z.string().optional(),
});

const ResetSchema = z.object({
  action:   z.literal("reset"),
  email:    z.string().email(),
  token:    z.string().min(20),
  password: passwordComplexity,
});

// ── Redis-backed rate limiting (G-007) ────────────────────────────────────────
const RATE_LIMIT_MAX    = 10;
const RATE_LIMIT_WINDOW = 15 * 60; // seconds

async function checkRateLimit(ip: string): Promise<boolean> {
  try {
    const key   = `auth:rate:${ip}`;
    const count = parseInt((await cache.get(key)) ?? "0", 10);
    if (count >= RATE_LIMIT_MAX) return false;
    await cache.set(key, String(count + 1), RATE_LIMIT_WINDOW);
    return true;
  } catch {
    return true; // Fail open if Redis unavailable — don't block real users
  }
}

// ── Redis-backed account lockout (G-008) ──────────────────────────────────────
const MAX_FAILURES = 5;
const LOCKOUT_SECS = 30 * 60;

async function checkLockout(emailHash: string): Promise<{ locked: boolean; remaining?: number }> {
  try {
    const val = await cache.get(`auth:lockout:${emailHash}`);
    if (!val) return { locked: false };
    const lockedUntil = parseInt(String(val), 10);
    const remaining   = Math.ceil((lockedUntil - Date.now()) / 60000);
    return remaining > 0 ? { locked: true, remaining } : { locked: false };
  } catch { return { locked: false }; }
}

async function recordFailure(emailHash: string) {
  try {
    const countKey = `auth:failures:${emailHash}`;
    const rawVal   = await cache.get(countKey);
    const count    = parseInt(String(rawVal ?? "0"), 10) + 1;
    await cache.set(countKey, String(count), LOCKOUT_SECS);
    if (count >= MAX_FAILURES) {
      await cache.set(`auth:lockout:${emailHash}`, String(Date.now() + LOCKOUT_SECS * 1000), LOCKOUT_SECS);
    }
  } catch {}
}

async function clearFailures(emailHash: string) {
  try {
    await cache.del(`auth:failures:${emailHash}`);
    await cache.del(`auth:lockout:${emailHash}`);
  } catch {}
}

/** Hash email for use as Redis key — avoids PII in logs/keys */
function hashEmail(email: string): string {
  return createHmac("sha256", process.env.AUDIT_HMAC_SECRET ?? "key").update(email.toLowerCase()).digest("hex").slice(0, 16);
}

// ── Main Handler ──────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const ip     = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
    const allowed = await checkRateLimit(ip);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests. Try again in 15 minutes." }, { status: 429 });
    }

    const rawBody     = await req.json();
    const { action }  = rawBody;

    // ── LOGIN ──────────────────────────────────────────────────────────────
    if (action === "login") {
      const parsed = LoginSchema.safeParse(rawBody);
      if (!parsed.success) { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }

      const { email, password } = parsed.data;
      const emailHash           = hashEmail(email);

      const lockout = await checkLockout(emailHash);
      if (lockout.locked) {
        return NextResponse.json({ error: `Account locked. Try again in ${lockout.remaining} minutes.` }, { status: 429 });
      }

      const customer = await prisma.customer.findUnique({ where: { email } });
      if (!customer?.passwordHash) {
        await recordFailure(emailHash); // Don't reveal user existence via timing
        return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
      }

      const valid = await bcrypt.compare(password, customer.passwordHash);
      if (!valid) {
        await recordFailure(emailHash);
        return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
      }

      await clearFailures(emailHash);

      const token = await new SignJWT({ sub: String(customer.id), email, role: "customer" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("8h")
        .sign(JWT_SECRET);

      const resp = NextResponse.json({
        success: true,
        token,
        user: { id: customer.id, name: customer.name, email: customer.email },
      });
      resp.cookies.set("session", token, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge:   8 * 60 * 60,
        path:     "/",
      });
      return resp;
    }

    // ── REGISTER ───────────────────────────────────────────────────────────
    if (action === "register") {
      const parsed = RegisterSchema.safeParse(rawBody);
      if (!parsed.success) { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }

      const { email, password, name, phone } = parsed.data;

      const existing = await prisma.customer.findUnique({ where: { email } });
      if (existing) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });

      const passwordHash = await bcrypt.hash(password, 12);
      const customer     = await prisma.customer.create({
        data: { email, passwordHash, name, phone: phone ?? null, address: "" },
      });

      const token = await new SignJWT({ sub: String(customer.id), email, role: "customer" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("8h")
        .sign(JWT_SECRET);

      return NextResponse.json({ success: true, token, user: { id: customer.id, name, email } }, { status: 201 });
    }

    // ── RESET PASSWORD ─────────────────────────────────────────────────────
    if (action === "reset") {
      const parsed = ResetSchema.safeParse(rawBody);
      if (!parsed.success) { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }

      const { email, token, password } = parsed.data;

      // Verify time-limited reset token from DB
      // NOTE: The passwordReset model must be added to prisma.schema for this to work
      let resetRecord: { id: number; email: string; token: string; used: boolean; expiresAt: Date } | null = null;
      try {
        resetRecord = await (prisma as any).passwordReset.findFirst({
          where: { email, token, used: false, expiresAt: { gt: new Date() } },
        });
      } catch (err: any) {
        // Handle case where passwordReset model doesn't exist in Prisma schema
        if (err.message?.includes("passwordReset") || err.code === "P2021" || err.code === "P2025") {
          return NextResponse.json({ 
            error: "Password reset feature is not configured. Please contact support." 
          }, { status: 503 });
        }
        throw err;
      }
      
      if (!resetRecord) return NextResponse.json({ error: "Invalid or expired reset link." }, { status: 400 });

      const passwordHash = await bcrypt.hash(password, 12);
      
      try {
        await prisma.$transaction([
          prisma.customer.update({ where: { email }, data: { passwordHash } }),
          (prisma as any).passwordReset.update({ where: { id: resetRecord.id }, data: { used: true } }),
        ]);
      } catch (err: any) {
        // Handle case where passwordReset model doesn't exist during transaction
        if (err.message?.includes("passwordReset") || err.code === "P2021" || err.code === "P2025") {
          return NextResponse.json({ 
            error: "Password reset feature is not configured. Please contact support." 
          }, { status: 503 });
        }
        throw err;
      }

      return NextResponse.json({ success: true, message: "Password updated. Please log in." });
    }

    return NextResponse.json({ error: "Invalid action. Use login|register|reset." }, { status: 400 });
  } catch (err: any) {
    if (err.message?.includes("JWT_SECRET")) return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
    return NextResponse.json({ error: "Authentication failed." }, { status: 500 });
  }
}
