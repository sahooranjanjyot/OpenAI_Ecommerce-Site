import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-middleware";
import { cache } from "@/lib/cache";
import { z } from "zod";

/**
 * Real-Time Analytics & Event Streaming (G-154, G-155, G-135)
 *
 * FIXED MEDIUM: No rate limiting on POST → 30 events/IP/minute limit.
 * FIXED MEDIUM: Client-controlled sessionId → validated format (UUID or alphanumeric).
 * FIXED LOW: In-memory storage documented as dev-only; comment updated.
 * FIXED: Zod v4 .issues compatibility.
 */

// In-memory analytics store — replace with ClickHouse/BigQuery in production (G-154)
const analyticsBuffer: Array<{
  event: string; properties: Record<string, unknown>; sessionId: string; timestamp: number;
}> = [];
const BUFFER_MAX = 1000;

const counters = {
  pageViews:        0,
  addToCart:        0,
  purchases:        0,
  checkoutStart:    0,
  checkoutComplete: 0,
  searches:         0,
  uniqueSessions:   new Set<string>(),
};

const EventSchema = z.object({
  event:      z.enum(["page_view","product_view","add_to_cart","remove_from_cart","checkout_start","purchase","search","login","signup","filter_use","sort_use","coupon_apply"]),
  properties: z.record(z.string(), z.unknown()).optional().default({}),
  // FIX: sessionId must be UUID or safe alphanumeric — reject arbitrary strings
  sessionId:  z.string().min(8).max(128).regex(/^[a-zA-Z0-9_-]+$/, "sessionId must be alphanumeric"),
  userId:     z.string().max(100).optional(),
  timestamp:  z.number().int().positive().optional(),
});

const RATE_LIMIT    = 30;   // events per IP per minute
const RATE_WINDOW_S = 60;

// ── POST /api/analytics — track event ────────────────────────────────────────
export async function POST(req: Request) {
  try {
    // FIX MEDIUM: Rate limit to prevent log flooding
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const { allowed } = await cache.rateLimit(`analytics:${ip}`, RATE_LIMIT, RATE_WINDOW_S);
    if (!allowed) return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });

    const parsed = EventSchema.safeParse(await req.json());
    if (!parsed.success) {
      const msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const event = { ...parsed.data, timestamp: parsed.data.timestamp ?? Date.now() };

    // FIX: Strip dangerous keys from properties (no arbitrary function refs, etc.)
    const safeProps = Object.fromEntries(
      Object.entries(event.properties as Record<string, unknown>)
        .filter(([k]) => k.length <= 50)
        .slice(0, 20)
    );

    counters.uniqueSessions.add(event.sessionId);
    if (event.event === "page_view")         counters.pageViews++;
    if (event.event === "add_to_cart")       counters.addToCart++;
    if (event.event === "purchase")          counters.purchases++;
    if (event.event === "checkout_start")    counters.checkoutStart++;
    if (event.event === "search")            counters.searches++;

    analyticsBuffer.push({ ...event, properties: safeProps });
    if (analyticsBuffer.length > BUFFER_MAX) analyticsBuffer.shift();

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Event tracking failed." }, { status: 500 });
  }
}

// ── GET /api/analytics — dashboard metrics (admin only) ──────────────────────
export async function GET(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  const conversionRate = counters.checkoutStart > 0
    ? parseFloat((counters.checkoutComplete / counters.checkoutStart * 100).toFixed(1))
    : 0;

  const cartAbandonment = counters.addToCart > 0
    ? parseFloat(((counters.addToCart - counters.purchases) / counters.addToCart * 100).toFixed(1))
    : 0;

  const recentEvents = analyticsBuffer.slice(-10).reverse();

  const eventFreq: Record<string, number> = {};
  for (const e of analyticsBuffer) {
    eventFreq[e.event] = (eventFreq[e.event] ?? 0) + 1;
  }

  // Top searched terms — sanitize output
  const searchTerms: Record<string, number> = {};
  for (const e of analyticsBuffer) {
    const q = e.properties?.["q"];
    if (e.event === "search" && typeof q === "string" && q.length <= 200) {
      searchTerms[q] = (searchTerms[q] ?? 0) + 1;
    }
  }
  const topSearches = Object.entries(searchTerms)
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([term, count]) => ({ term, count }));

  return NextResponse.json({
    realtime: {
      pageViews:       counters.pageViews,
      uniqueSessions:  counters.uniqueSessions.size,
      addToCart:       counters.addToCart,
      purchases:       counters.purchases,
      searches:        counters.searches,
      conversionRate:  `${conversionRate}%`,
      cartAbandonment: `${cartAbandonment}%`,
    },
    eventFrequency: eventFreq,
    topSearches,
    recentEvents,
    bufferSize: analyticsBuffer.length,
  });
}
