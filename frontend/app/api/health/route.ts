import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-middleware";

/**
 * Health Check (G-019)
 *
 * FIX MEDIUM-B4-004: Public endpoint returns minimal info only.
 *   Admin token required for detailed diagnostics — prevents
 *   environment reconnaissance by attackers.
 */

import { prisma } from "@/lib/prisma";
import { cache } from "@/lib/cache";

async function checkDatabase(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  }
}

async function checkRedis(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    await cache.set("health:ping", "pong", 10);
    const val = await cache.get("health:ping");
    return { ok: val === "pong", latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const detailed = searchParams.get("detailed") === "true";

  // Detailed health check requires admin auth (prevents info leakage)
  if (detailed) {
    const authErr = requireAdmin(req);
    if (authErr) return authErr;

    const [db, redis] = await Promise.all([checkDatabase(), checkRedis()]);
    const allHealthy  = db.ok && redis.ok;

    return NextResponse.json({
      status:    allHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      services: {
        database: db,
        redis:    redis,
      },
      version:   process.env.npm_package_version ?? "1.0.0",
      env:       process.env.NODE_ENV ?? "production",
      uptime:    `${Math.floor(process.uptime() / 60)}m ${Math.floor(process.uptime() % 60)}s`,
    }, { status: allHealthy ? 200 : 503 });
  }

  // Public endpoint — minimal response only (no env/version leak)
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch {
    return NextResponse.json({ status: "unhealthy" }, { status: 503 });
  }
}
