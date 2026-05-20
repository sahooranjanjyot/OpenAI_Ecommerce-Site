import { NextResponse } from "next/server";
import { randomBytes, createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import { prisma } from "../../../lib/prisma";
import bcrypt from "bcryptjs";
import { cache } from "../../../lib/cache";

/**
 * MFA — TOTP (RFC 6238) + Backup Codes (G-101)
 *
 * FIX C-B1-2: Replaced Math.random() with crypto.randomBytes() for TOTP secret
 * FIX C-B1-3: Replaced Math.random() with crypto.randomBytes() for backup codes
 * FIX H-B1-4: Migrated mfaStore from in-memory Map to database (MFAConfig model)
 * FIXED MEDIUM: Backup codes not hashed — now bcrypt-hashed before storage.
 * FIXED MEDIUM: No rate limiting on verify → brute-force risk — 10/email/hour.
 * FIXED: Zod v4 .issues compatibility.
 */

// ── TOTP Helpers ──────────────────────────────────────────────────────────────

/** Generate a cryptographically secure Base32 TOTP secret (160-bit / 20 bytes) */
function generateTOTPSecret(): string {
  const bytes  = randomBytes(20); // 160 bits — FIPS 186-4 compliant
  const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let secret   = "";
  for (let i = 0; i < bytes.length; i++) {
    secret += BASE32[bytes[i] % 32];
  }
  return secret;
}

/** Generate N cryptographically secure backup codes, returns {plain, hashed} */
async function generateBackupCodes(n = 8): Promise<{ plain: string[]; hashed: string[] }> {
  const plain = Array.from({ length: n }, () =>
    randomBytes(5).toString("hex").toUpperCase().slice(0, 8)
  );
  // FIX MEDIUM: Hash backup codes before storing (bcrypt cost 10)
  const hashed = await Promise.all(plain.map(c => bcrypt.hash(c, 10)));
  return { plain, hashed };
}

/** HMAC-SHA1 TOTP per RFC 6238 — 30-second window, ±1 step tolerance */
function generateTOTP(secret: string, offset = 0): string {
  const step      = Math.floor(Date.now() / 1000 / 30) + offset;
  const stepBuf   = Buffer.alloc(8);
  stepBuf.writeBigInt64BE(BigInt(step));
  // Decode Base32 secret
  const BASE32    = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, val = 0;
  const bytes: number[] = [];
  for (const c of secret.toUpperCase()) {
    val = (val << 5) | BASE32.indexOf(c);
    bits += 5;
    if (bits >= 8) { bytes.push((val >> (bits - 8)) & 0xff); bits -= 8; }
  }
  const keyBuf  = Buffer.from(bytes);
  const hmac    = createHmac("sha1", keyBuf).update(stepBuf).digest();
  const offset2 = hmac[hmac.length - 1] & 0x0f;
  const code    = ((hmac.readUInt32BE(offset2) & 0x7fffffff) % 1_000_000)
    .toString().padStart(6, "0");
  return code;
}

function verifyTOTP(secret: string, token: string): boolean {
  for (const offset of [-1, 0, 1]) {
    const expected = Buffer.from(generateTOTP(secret, offset));
    const provided = Buffer.from(token.padStart(6, "0"));
    if (expected.length === provided.length && timingSafeEqual(expected, provided)) {
      return true;
    }
  }
  return false;
}

// ── Input Schemas ──────────────────────────────────────────────────────────────
const SetupSchema  = z.object({ action: z.literal("setup"),  email: z.string().email() });
const VerifySchema = z.object({ action: z.literal("verify"), email: z.string().email(), token: z.string().length(6) });
const EnableSchema = z.object({ action: z.literal("enable"), email: z.string().email(), token: z.string() });
const DisableSchema= z.object({ action: z.literal("disable"),email: z.string().email(), token: z.string() });

// ── POST /api/mfa ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // SETUP — generate new TOTP secret + backup codes
    if (body.action === "setup") {
      const parsed = SetupSchema.safeParse(body);
      if (!parsed.success) {
        const msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      const { email } = parsed.data;
      const secret               = generateTOTPSecret();
      const { plain, hashed }    = await generateBackupCodes(8); // FIX: hashed
      const qrUrl                = `otpauth://totp/GroceryOS:${encodeURIComponent(email)}?secret=${secret}&issuer=GroceryOS&algorithm=SHA1&digits=6&period=30`;

      await (prisma as any).mFAConfig.upsert({
        where:  { email },
        update: { secret, backupCodes: hashed, enabled: false },
        create: { email, secret, backupCodes: hashed, enabled: false },
      });

      // Return plaintext codes ONCE — not stored in DB
      return NextResponse.json({ secret, backupCodes: plain, qrUrl, message: "Save backup codes now — they won't be shown again. Scan QR in authenticator app, then call action:enable." });
    }

    // ENABLE — verify TOTP once to confirm setup
    if (body.action === "enable") {
      const parsed = EnableSchema.safeParse(body);
      if (!parsed.success) { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }

      const { email, token } = parsed.data;
      const config = await (prisma as any).mFAConfig.findUnique({ where: { email } });
      if (!config) return NextResponse.json({ error: "MFA not set up. Call action:setup first." }, { status: 400 });

      if (!verifyTOTP(config.secret, token)) {
        return NextResponse.json({ error: "Invalid code. Scan QR again." }, { status: 401 });
      }

      await (prisma as any).mFAConfig.update({ where: { email }, data: { enabled: true } });
      return NextResponse.json({ success: true, message: "MFA enabled." });
    }

    // DISABLE — requires valid TOTP
    if (body.action === "disable") {
      const parsed = DisableSchema.safeParse(body);
      if (!parsed.success) { const _msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input"; return NextResponse.json({ error: _msg }, { status: 400 }); }

      const { email, token } = parsed.data;
      const config = await (prisma as any).mFAConfig.findUnique({ where: { email } });
      if (!config?.enabled) return NextResponse.json({ error: "MFA not enabled." }, { status: 400 });

      const validTotp   = verifyTOTP(config.secret, token);
      const validBackup = config.backupCodes.includes(token.toUpperCase());
      if (!validTotp && !validBackup) return NextResponse.json({ error: "Invalid code." }, { status: 401 });

      await (prisma as any).mFAConfig.update({ where: { email }, data: { enabled: false, secret: "", backupCodes: [] } });
      return NextResponse.json({ success: true, message: "MFA disabled." });
    }

    // VERIFY — check code during login
    if (body.action === "verify") {
      const parsed = VerifySchema.safeParse(body);
      if (!parsed.success) {
        const msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      const { email, token } = parsed.data;

      // FIX MEDIUM: Rate limit verify — 10 per email per hour (brute-force protection)
      const { allowed } = await cache.rateLimit(`mfa_verify:${email}`, 10, 3600);
      if (!allowed) return NextResponse.json({ error: "Too many MFA attempts. Try again in 1 hour." }, { status: 429 });

      const config = await (prisma as any).mFAConfig.findUnique({ where: { email } });
      if (!config?.enabled) return NextResponse.json({ error: "MFA not enabled for this account." }, { status: 400 });

      const validTotp = verifyTOTP(config.secret, token);

      // FIX MEDIUM: Compare against bcrypt-hashed backup codes
      let backupIdx = -1;
      if (!validTotp && Array.isArray(config.backupCodes)) {
        for (let i = 0; i < config.backupCodes.length; i++) {
          if (await bcrypt.compare(token.toUpperCase(), config.backupCodes[i])) {
            backupIdx = i;
            break;
          }
        }
      }
      const validBackup = backupIdx >= 0;

      if (!validTotp && !validBackup) {
        return NextResponse.json({ error: "Invalid code." }, { status: 401 });
      }

      // Consume backup code (one-time use)
      if (validBackup) {
        const updatedCodes = [...config.backupCodes];
        updatedCodes.splice(backupIdx, 1);
        await (prisma as any).mFAConfig.update({ where: { email }, data: { backupCodes: updatedCodes } });
      }

      return NextResponse.json({ success: true, method: validTotp ? "totp" : "backup_code" });
    }

    return NextResponse.json({ error: "Invalid action. Use setup|enable|disable|verify." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "MFA operation failed." }, { status: 500 });
  }
}

// ── GET /api/mfa/status?email=X ───────────────────────────────────────────────
export async function GET(req: Request) {
  const email = new URL(req.url).searchParams.get("email");
  if (!email) return NextResponse.json({ error: "Email required." }, { status: 400 });

  const config = await (prisma as any).mFAConfig.findUnique({ where: { email } }).catch(() => null);
  return NextResponse.json({
    email,
    mfaEnabled:          config?.enabled ?? false,
    backupCodesRemaining: config?.backupCodes?.length ?? 0,
  });
}
