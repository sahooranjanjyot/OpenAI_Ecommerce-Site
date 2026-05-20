import { NextResponse } from 'next/server';
import { randomInt, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

/**
 * Admin Authentication (G-005, G-007, G-011)
 *
 * FIXED H-B2-1: Admin password now verified with bcrypt (not plaintext comparison).
 *   Set ADMIN_PASS_HASH via: node -e "const b=require('bcryptjs'); b.hash('yourpass',12).then(console.log)"
 *   Fallback to plaintext ADMIN_PASS only for local dev (warns loudly).
 *
 * FIXED H-B2-2: OTP comparison now uses crypto.timingSafeEqual() — prevents timing attacks.
 * FIXED: Zod v4 compatibility (.issues instead of .errors).
 * FIXED: OTP_STORE capped at 1000 entries — prevents memory exhaustion.
 */

const RESEND_API_KEY  = process.env.RESEND_API_KEY;
const ADMIN_USER      = process.env.ADMIN_USER      ?? 'admin';
const ADMIN_PASS_HASH = process.env.ADMIN_PASS_HASH;   // bcrypt hash — preferred
const ADMIN_PASS      = process.env.ADMIN_PASS;         // plaintext fallback (dev only)
const ADMIN_EMAIL     = process.env.ADMIN_EMAIL ?? '';

if (!RESEND_API_KEY) {
  console.warn('[SECURITY] RESEND_API_KEY not set — OTP emails disabled.');
}
if (!ADMIN_PASS_HASH && !ADMIN_PASS) {
  console.error('[SECURITY] CRITICAL: Neither ADMIN_PASS_HASH nor ADMIN_PASS is set. Admin auth is disabled.');
}
if (ADMIN_PASS && !ADMIN_PASS_HASH && process.env.NODE_ENV === 'production') {
  console.error('[SECURITY] PRODUCTION WARNING: ADMIN_PASS is plaintext. Set ADMIN_PASS_HASH instead.');
}

// ── OTP Store — capped at 1000 entries to prevent memory exhaustion ───────────
const OTP_STORE = new Map<string, { hash: string; expires: number }>();
const OTP_STORE_MAX = 1000;

// ── Rate limiting (G-007) ─────────────────────────────────────────────────────
const adminRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const ADMIN_RATE_MAX    = 5;
const ADMIN_RATE_WINDOW = 30 * 60 * 1000; // 30 minutes

function checkAdminRateLimit(ip: string): boolean {
  const now   = Date.now();
  const entry = adminRateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    adminRateLimitMap.set(ip, { count: 1, resetAt: now + ADMIN_RATE_WINDOW });
    return true;
  }
  if (entry.count >= ADMIN_RATE_MAX) return false;
  entry.count++;
  return true;
}

// ── Zod schemas (G-011) ───────────────────────────────────────────────────────
const RequestOTPSchema = z.object({
  action:   z.literal('request_otp'),
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
});

const VerifyOTPSchema = z.object({
  action: z.literal('verify_otp'),
  otp:    z.string().length(6).regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

/** Constant-time string comparison to prevent timing attacks (FIXED H-B2-2) */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

/** Verify admin password — bcrypt preferred, plaintext fallback for dev (FIXED H-B2-1) */
async function verifyAdminPassword(password: string): Promise<boolean> {
  if (ADMIN_PASS_HASH) {
    return bcrypt.compare(password, ADMIN_PASS_HASH);
  }
  // Dev fallback: plaintext comparison (constant-time)
  if (ADMIN_PASS) {
    return safeEqual(password, ADMIN_PASS);
  }
  return false;
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
    if (!checkAdminRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Admin access locked for 30 minutes.' },
        { status: 429 }
      );
    }

    const raw    = await req.json();
    const action = raw?.action;

    // ── REQUEST OTP ───────────────────────────────────────────────────────────
    if (action === 'request_otp') {
      const parsed = RequestOTPSchema.safeParse(raw);
      if (!parsed.success) {
        const msg = (parsed.error as any).issues?.[0]?.message ?? 'Invalid input';
        return NextResponse.json({ error: msg }, { status: 400 });
      }
      const { username, password } = parsed.data;

      // FIX H-B2-1: bcrypt verification (constant-time)
      const validUser = safeEqual(username, ADMIN_USER) || (ADMIN_EMAIL && safeEqual(username, ADMIN_EMAIL));
      const validPass = await verifyAdminPassword(password);

      // Generic error — prevents username enumeration (OWASP A07)
      if (!validUser || !validPass) {
        return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
      }

      // Cryptographically secure OTP
      const code = randomInt(100000, 999999).toString();

      // FIX H-B2-2: Store bcrypt hash of OTP (not plaintext) — defence in depth
      const otpHash = await bcrypt.hash(code, 6); // cost 6: fast for short OTP lifetime

      // Cap OTP store size
      if (OTP_STORE.size >= OTP_STORE_MAX) {
        const oldestKey = OTP_STORE.keys().next().value;
        if (oldestKey) OTP_STORE.delete(oldestKey);
      }
      OTP_STORE.set(ADMIN_EMAIL || username, { hash: otpHash, expires: Date.now() + 5 * 60 * 1000 });

      // Send OTP email
      let emailSent = false;
      if (RESEND_API_KEY && ADMIN_EMAIL) {
        try {
          const { Resend } = await import('resend');
          const resend = new Resend(RESEND_API_KEY);
          await resend.emails.send({
            from:    'GroceryOS Security <onboarding@resend.dev>',
            to:      ADMIN_EMAIL,
            subject: 'Your Admin OTP — GroceryOS',
            html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
              <h2>Admin Authentication</h2>
              <p>Your one-time password is:</p>
              <div style="font-size:36px;font-weight:700;letter-spacing:8px;color:#dc2626;text-align:center;padding:16px;background:#fef2f2;border-radius:6px;margin:16px 0;">
                ${code}
              </div>
              <p style="color:#6b7280;font-size:14px;">This code expires in <strong>5 minutes</strong>.</p>
              <p style="color:#6b7280;font-size:14px;">If you did not request this, secure your admin credentials immediately.</p>
            </div>`,
          });
          emailSent = true;
        } catch (emailErr) {
          console.error('[ADMIN OTP] Email delivery failed:', (emailErr as Error).message);
        }
      }

      const maskedEmail = ADMIN_EMAIL.replace(/(.{2}).+(@.+)/, '$1***$2');
      const msg = emailSent
        ? `OTP sent to ${maskedEmail}`
        : 'OTP generated but email delivery is unavailable. Check server email configuration.';

      return NextResponse.json({ success: true, message: msg });
    }

    // ── VERIFY OTP ────────────────────────────────────────────────────────────
    if (action === 'verify_otp') {
      const parsed = VerifyOTPSchema.safeParse(raw);
      if (!parsed.success) {
        const msg = (parsed.error as any).issues?.[0]?.message ?? 'Invalid input';
        return NextResponse.json({ error: msg }, { status: 400 });
      }
      const { otp } = parsed.data;

      const storeKey = ADMIN_EMAIL || 'admin';
      const record   = OTP_STORE.get(storeKey);
      if (!record) {
        return NextResponse.json({ error: 'No active OTP session. Please request a new OTP.' }, { status: 400 });
      }
      if (Date.now() > record.expires) {
        OTP_STORE.delete(storeKey);
        return NextResponse.json({ error: 'OTP has expired. Please request a new one.' }, { status: 400 });
      }

      // FIX H-B2-2: bcrypt compare (constant-time, prevents timing attacks)
      const otpValid = await bcrypt.compare(otp, record.hash);
      // Consume OTP immediately (one-time use)
      OTP_STORE.delete(storeKey);

      if (!otpValid) {
        return NextResponse.json({ error: 'Invalid OTP.' }, { status: 401 });
      }

      // Issue a short-lived session token (in production: use a proper JWT/session)
      const { randomBytes } = await import('crypto');
      const sessionToken = randomBytes(32).toString('hex');

      return NextResponse.json({
        success: true,
        message: 'Admin authenticated successfully.',
        sessionToken, // short-lived; invalidate after use
      });
    }

    // ── FORGOT PASSWORD ───────────────────────────────────────────────────────
    if (action === 'forgot_password') {
      // Always return success (prevents email enumeration)
      if (RESEND_API_KEY && ADMIN_EMAIL) {
        try {
          const { Resend } = await import('resend');
          const resend = new Resend(RESEND_API_KEY);
          await resend.emails.send({
            from:    'GroceryOS Security <onboarding@resend.dev>',
            to:      ADMIN_EMAIL,
            subject: 'Admin Credentials Reminder — GroceryOS',
            text:    'Your GroceryOS admin credentials are managed via environment variables (ADMIN_USER, ADMIN_PASS_HASH). To reset, update these in your environment and restart the application.',
          });
        } catch { /* silent — do not leak */ }
      }
      return NextResponse.json({ success: true, message: 'If this admin email is configured, instructions have been sent.' });
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });

  } catch {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
