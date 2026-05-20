import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/auth-middleware";
import { z } from "zod";
import { cache } from "../../../lib/cache";

/**
 * Frontend Error Reporting (G-020, G-079)
 *
 * FIXED H-B9-1: Unauthenticated POST allows anyone to flood the error log.
 *   - Rate-limited by IP (10 reports per minute)
 *   - Error log capped at 200 entries (was already capped, confirmed)
 *   - POST no longer exposes the errorId back without rate-limiting
 *
 * Note: POST remains publicly accessible (error reporting must work for
 * anonymous users / unauthenticated sessions) but is now rate-limited
 * and does NOT require auth — this is the intended design.
 * GET (read log) remains admin-only.
 */

const ErrorSchema = z.object({
  errorId:   z.string().uuid("errorId must be a valid UUID"),
  message:   z.string().min(1).max(500),
  stack:     z.string().max(5000).optional(),
  component: z.string().max(200).optional(),
  url:       z.string().url().max(500).optional(),
  userAgent: z.string().max(300).optional(),
  timestamp: z.string().datetime().optional(),
});

// In-memory error log (replace with Sentry/Datadog in production)
const errorLog: any[] = [];
const ERROR_LOG_MAX   = 200;
const RATE_KEY_PREFIX = "errs:";
const RATE_LIMIT      = 10;   // per IP per minute
const RATE_WINDOW_S   = 60;

export async function POST(req: Request) {
  try {
    // Rate limit by IP — prevents log flooding (H-B9-1 partial fix)
    const ip      = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const { allowed } = await cache.rateLimit(`${RATE_KEY_PREFIX}${ip}`, RATE_LIMIT, RATE_WINDOW_S);
    if (!allowed) {
      return NextResponse.json({ ok: false }, { status: 429 });
    }

    const parsed = ErrorSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

    const entry = {
      ...parsed.data,
      ip,
      receivedAt: new Date().toISOString(),
    };

    // Prepend and cap
    errorLog.unshift(entry);
    if (errorLog.length > ERROR_LOG_MAX) errorLog.length = ERROR_LOG_MAX;

    // Strip stack trace from log in production (avoid PII/code exposure in logs)
    const logEntry = { errorId: entry.errorId, message: entry.message, url: entry.url };
    console.error(`[Client Error] ${JSON.stringify(logEntry)}`);

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  return NextResponse.json({
    errors: errorLog.slice(0, 50),
    total:  errorLog.length,
  });
}
