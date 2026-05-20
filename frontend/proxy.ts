import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
// NOTE: middleware runs in Edge Runtime — Node.js 'crypto' is not available.
// Use Web Crypto API (TextEncoder + constant-time compare) instead.

// ── Security Headers (G-009, G-010) ──────────────────────────────────────────
const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(self), interest-cohort=()",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://js.stripe.com/v3/",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://api.stripe.com https://api.qrserver.com",
    "frame-src 'none' https://js.stripe.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
  "Cross-Origin-Opener-Policy":   "same-origin",
  "Cross-Origin-Resource-Policy": "cross-origin",
  // COEP require-corp removed — breaks Stripe.js and third-party scripts in dev
};

// ── Routes that bypass CSRF (webhook/voice receive external POST) ─────────────
const CSRF_EXEMPT_PREFIXES = [
  "/api/webhooks",
  "/api/voice",
  "/api/payments/stripe", // Stripe sends signed POSTs
  "/api/payments/paypal",
  "/api/payments/klarna",
  "/api/csrf",            // The CSRF token issuance endpoint itself
  "/api/health",
];

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// ── CSRF double-submit cookie validation ──────────────────────────────────────
// Edge-compatible constant-time comparison (avoids timing attacks)
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

function validateCsrf(request: NextRequest): boolean {
  const method = request.method.toUpperCase();
  if (SAFE_METHODS.has(method)) return true;

  const path = request.nextUrl.pathname;
  if (CSRF_EXEMPT_PREFIXES.some(p => path.startsWith(p))) return true;

  const headerToken = request.headers.get("x-csrf-token");
  const cookieToken = request.cookies.get("csrf_token")?.value;

  if (!headerToken || !cookieToken) return false;
  return constantTimeEqual(headerToken, cookieToken);
}

export function proxy(request: NextRequest) {
  // HTTPS redirect in production
  if (
    process.env.NODE_ENV === "production" &&
    request.headers.get("x-forwarded-proto") === "http"
  ) {
    return NextResponse.redirect(
      `https://${request.headers.get("host")}${request.nextUrl.pathname}`,
      { status: 301 }
    );
  }

  // CSRF validation for state-mutating API routes
  if (request.nextUrl.pathname.startsWith("/api/")) {
    if (!validateCsrf(request)) {
      return NextResponse.json(
        { error: "Invalid or missing CSRF token." },
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  const response = NextResponse.next();

  // Apply security headers to all responses
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Add request ID for correlation/tracing
  const requestId = crypto.randomUUID();
  response.headers.set("X-Request-ID", requestId);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
