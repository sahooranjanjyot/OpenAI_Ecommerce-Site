import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, getSession } from "../../../lib/auth-middleware";
import { cache } from "../../../lib/cache";

/**
 * A/B Testing Framework (G-136, G-137)
 *
 * FIXED H-B10-1: Unauthenticated conversion recording allowed anyone to
 *   manipulate experiment metrics. Now:
 *   - "record" action requires a valid user session (JWT) or admin JWT
 *   - Rate-limited at 30 conversions per user per hour to prevent stuffing
 *   - Experiment ID and variant are cross-validated (variant must belong to experiment)
 *
 * FIXED: Zod v4 .issues compatibility.
 */

// ── In-memory experiment store ─────────────────────────────────────────────────
const experiments = new Map<string, {
  id: string; name: string; variants: string[]; weights?: number[];
  active: boolean; metrics: Record<string, { views: number; conversions: number }>;
}>();

const ExperimentSchema = z.object({
  id:       z.string().min(1).max(50).regex(/^[a-z0-9_-]+$/),
  name:     z.string().min(1).max(200),
  variants: z.array(z.string().min(1).max(50)).min(2, "Need at least 2 variants"),
  weights:  z.array(z.number().positive()).optional(),
  active:   z.boolean().default(true),
});

const ConversionSchema = z.object({
  experimentId: z.string().min(1).max(50).regex(/^[a-z0-9_-]+$/),
  variantId:    z.string().min(1).max(50),
  event:        z.enum(["view", "click", "add_to_cart", "purchase", "signup"]),
});

function assignVariant(userId: string, experimentId: string, variants: string[], weights?: number[]): string {
  const hash = Array.from(`${userId}:${experimentId}`).reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);
  const idx  = Math.abs(hash) % variants.length;
  if (weights && weights.length === variants.length) {
    const total = weights.reduce((s, w) => s + w, 0);
    const norm  = weights.map(w => w / total);
    let cumul   = 0;
    const pick  = (Math.abs(hash) % 10000) / 10000;
    for (let i = 0; i < norm.length; i++) {
      cumul += norm[i];
      if (pick <= cumul) return variants[i];
    }
  }
  return variants[idx];
}

// ── GET /api/experiments ──────────────────────────────────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const expId   = searchParams.get("id");
  const userId  = searchParams.get("userId");
  const authErr = requireAdmin(req);
  const isAdmin = !authErr;

  // Admin: list all experiments with full metrics
  if (isAdmin && !userId) {
    return NextResponse.json(Array.from(experiments.values()));
  }

  // Public: get variant assignment for a specific user + experiment
  if (expId && userId) {
    const exp = experiments.get(expId);
    if (!exp || !exp.active) return NextResponse.json({ variant: null, active: false });
    const variant = assignVariant(userId, expId, exp.variants, exp.weights);

    if (!exp.metrics[variant]) exp.metrics[variant] = { views: 0, conversions: 0 };

    // FIXED BUG: Deduplicate view counts per user+experiment+variant
    // Without this, every page refresh incremented views — inflating metrics
    const dedupeKey = `abtest:view:${expId}:${variant}:${userId}`;
    const alreadySeen = await cache.get<boolean>(dedupeKey);
    if (!alreadySeen) {
      exp.metrics[variant].views++;
      await cache.set(dedupeKey, true, 86400); // dedup window: 24 hours
    }

    return NextResponse.json({ experimentId: expId, variant, active: true });
  }

  // Public: list active experiments (names + variants only — no metrics)
  return NextResponse.json(
    Array.from(experiments.values())
      .filter(e => e.active)
      .map(e => ({ id: e.id, name: e.name, variants: e.variants, active: e.active }))
  );
}

// ── POST /api/experiments ─────────────────────────────────────────────────────
export async function POST(req: Request) {
  const body    = await req.json();
  const authErr = requireAdmin(req);
  const isAdmin = !authErr;

  // ── Record conversion event — FIXED H-B10-1 ──────────────────────────────────
  if (body.action === "record") {
    // Require authenticated session (user OR admin)
    const session = await getSession(req);
    if (!session && !isAdmin) {
      return NextResponse.json({ error: "Authentication required to record conversions." }, { status: 401 });
    }

    const parsed = ConversionSchema.safeParse(body);
    if (!parsed.success) {
      const msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { experimentId, variantId, event } = parsed.data;
    const exp = experiments.get(experimentId);
    if (!exp) return NextResponse.json({ error: "Experiment not found." }, { status: 404 });

    // Cross-validate: variantId must belong to this experiment
    if (!exp.variants.includes(variantId)) {
      return NextResponse.json({ error: "Invalid variant for this experiment." }, { status: 400 });
    }

    // Rate limit: 30 conversion events per user per hour (prevents metric stuffing)
    const rateLimitKey = `exp_conv:${session?.userId ?? "anon"}:${experimentId}`;
    const { allowed }  = await cache.rateLimit(rateLimitKey, 30, 3600);
    if (!allowed) {
      return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
    }

    if (!exp.metrics[variantId]) exp.metrics[variantId] = { views: 0, conversions: 0 };
    if (event === "purchase" || event === "signup") exp.metrics[variantId].conversions++;

    return NextResponse.json({ success: true, recorded: event });
  }

  // ── Create experiment — admin only ────────────────────────────────────────────
  if (authErr) return authErr;

  const parsed = ExperimentSchema.safeParse(body);
  if (!parsed.success) {
    const msg = (parsed.error as any).issues?.[0]?.message ?? "Invalid input";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Validate weights if provided
  if (parsed.data.weights && parsed.data.weights.length !== parsed.data.variants.length) {
    return NextResponse.json({ error: "weights array must have same length as variants." }, { status: 400 });
  }

  const exp = { ...parsed.data, metrics: {} as any };
  for (const v of exp.variants) exp.metrics[v] = { views: 0, conversions: 0 };
  experiments.set(exp.id, exp);

  return NextResponse.json(exp, { status: 201 });
}

// ── PUT /api/experiments — admin: get results ─────────────────────────────────
export async function PUT(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  try {
    const { id } = await req.json();
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Experiment id required." }, { status: 400 });
    }
    const exp = experiments.get(id);
    if (!exp) return NextResponse.json({ error: "Experiment not found." }, { status: 404 });

    const results = exp.variants.map(v => {
      const m        = exp.metrics[v] ?? { views: 0, conversions: 0 };
      const convRate = m.views > 0 ? parseFloat((m.conversions / m.views * 100).toFixed(2)) : 0;
      return { variant: v, views: m.views, conversions: m.conversions, conversionRate: convRate };
    });

    const winner = results.reduce(
      (best, r) => r.conversionRate > best.conversionRate ? r : best,
      results[0]
    );

    return NextResponse.json({ experimentId: id, name: exp.name, active: exp.active, results, winner: winner?.variant });
  } catch {
    return NextResponse.json({ error: "Failed to get results." }, { status: 500 });
  }
}
