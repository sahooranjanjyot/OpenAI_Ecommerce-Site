import { NextResponse } from "next/server";
import { featureFlags } from "@/lib/feature-flags";
import { requireAdmin } from "@/lib/auth-middleware";
import { z } from "zod";

/**
 * Feature Flags API (GAP-135)
 * GET  /api/flags?userId=X  — client bootstrap (public — flags are not secrets)
 * POST /api/flags           — admin override (runtime) — requires admin JWT
 *
 * FIXED C-NEW-1: Removed duplicate insecure POST function that used plain
 * x-admin-token header comparison (bypassed JWT auth).
 * FIXED: Zod v4 compatibility — use .issues instead of .errors
 */

// Runtime overrides — use Redis in production for multi-instance consistency
const overrides: Record<string, boolean> = {};

const FlagOverrideSchema = z.object({
  key:     z.string().min(1).max(100).regex(/^[a-z0-9_]+$/, "Flag key: lowercase letters, numbers, underscores only"),
  enabled: z.boolean(),
});

export async function GET(req: Request) {
  const userId = new URL(req.url).searchParams.get("userId") ?? "anonymous";
  const flags  = featureFlags.getAll(userId);
  // Apply runtime overrides (overridden flags marked so clients can distinguish)
  Object.assign(flags, Object.fromEntries(
    Object.entries(overrides).map(([k, v]) => [k, { ...flags[k], enabled: v, overridden: true }])
  ));
  return NextResponse.json({ userId, flags, ts: new Date().toISOString() });
}

export async function POST(req: Request) {
  // JWT-protected: requireAdmin verifies Bearer token
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  try {
    const parsed = FlagOverrideSchema.safeParse(await req.json());
    if (!parsed.success) {
      // Zod v4: use .issues instead of .errors
      const msg = (parsed.error as any).issues?.[0]?.message
               ?? (parsed.error as any).errors?.[0]?.message
               ?? "Invalid input";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const { key, enabled } = parsed.data;
    overrides[key] = enabled;
    return NextResponse.json({ success: true, key, enabled });
  } catch {
    return NextResponse.json({ error: "Failed to update flag." }, { status: 500 });
  }
}
