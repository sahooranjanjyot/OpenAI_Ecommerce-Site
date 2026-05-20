/**
 * rateLimit response headers helper (FIXED MEDIUM: Missing X-RateLimit-* headers)
 *
 * Adds standard rate-limit response headers to a NextResponse so clients
 * can implement intelligent back-off and UI feedback.
 *
 * Usage:
 *   const { allowed, remaining, resetAt } = await cache.rateLimit(key, limit, window);
 *   if (!allowed) {
 *     return withRateLimitHeaders(
 *       NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 }),
 *       { limit, remaining, resetAt }
 *     );
 *   }
 *   const response = NextResponse.json(data);
 *   return withRateLimitHeaders(response, { limit, remaining, resetAt });
 */
import { NextResponse } from "next/server";

interface RateLimitInfo {
  limit:     number;
  remaining: number;
  resetAt:   number;  // Unix timestamp ms
}

/**
 * Adds X-RateLimit-* headers to any NextResponse.
 * Follows the IETF draft standard (draft-ietf-httpapi-ratelimit-headers).
 */
export function withRateLimitHeaders(
  response: NextResponse,
  { limit, remaining, resetAt }: RateLimitInfo
): NextResponse {
  const resetSec = Math.ceil(resetAt / 1000);
  response.headers.set("X-RateLimit-Limit",     String(limit));
  response.headers.set("X-RateLimit-Remaining", String(Math.max(0, remaining)));
  response.headers.set("X-RateLimit-Reset",     String(resetSec));
  response.headers.set("RateLimit-Limit",       String(limit));
  response.headers.set("RateLimit-Remaining",   String(Math.max(0, remaining)));
  response.headers.set("RateLimit-Reset",       String(resetSec));
  if (remaining <= 0) {
    // Retry-After in seconds (RFC 7231)
    const retryAfter = Math.max(0, Math.ceil((resetAt - Date.now()) / 1000));
    response.headers.set("Retry-After", String(retryAfter));
  }
  return response;
}

/**
 * Convenience: create a 429 response with full rate-limit headers.
 */
export function rateLimitExceededResponse(info: RateLimitInfo): NextResponse {
  return withRateLimitHeaders(
    NextResponse.json(
      { error: "Rate limit exceeded. Please slow down.", retryAfter: Math.ceil((info.resetAt - Date.now()) / 1000) },
      { status: 429 }
    ),
    info
  );
}
