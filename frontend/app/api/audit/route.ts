import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { requireAdmin } from "../../../lib/auth-middleware";
import { createHmac } from "crypto";

/**
 * Centralised tamper-evident audit log (G-044, G-094, PCI-DSS Req 10)
 *
 * FIX C-B1-4: Removed hardcoded fallback HMAC secret.
 *   Server now refuses to start logging if AUDIT_HMAC_SECRET is missing,
 *   preventing silent integrity compromise.
 */

function getHmacSecret(): string {
  const secret = process.env.AUDIT_HMAC_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "[AUDIT] AUDIT_HMAC_SECRET env var missing or too short (min 32 chars). " +
      "Generate with: openssl rand -hex 32"
    );
  }
  return secret;
}

function computeChecksum(entry: {
  action: string; resource: string; userId: string;
  ip: string; timestamp: string; payload: string;
}): string {
  const secret = getHmacSecret();
  const data   = `${entry.action}|${entry.resource}|${entry.userId}|${entry.ip}|${entry.timestamp}|${entry.payload}`;
  return createHmac("sha256", secret).update(data).digest("hex");
}

/**
 * Derive IP address server-side from request headers.
 * Never trust client-supplied IP in request body.
 */
function deriveIpFromRequest(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs; take the first (client IP)
    const firstIp = forwarded.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }
  return "unknown";
}

export async function GET(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  try {
    const { searchParams } = new URL(req.url);
    const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
    const limit = Math.min(200, parseInt(searchParams.get("limit") ?? "50", 10));
    const skip  = (page - 1) * limit;

    // Optional filters
    const action   = searchParams.get("action");
    const userId   = searchParams.get("userId");
    const dateFrom = searchParams.get("from");
    const dateTo   = searchParams.get("to");

    const where: any = {};
    if (action)   where.action   = action;
    if (userId)   where.userId   = userId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo)   where.createdAt.lte = new Date(dateTo);
    }

    const [logs, total] = await Promise.all([
      (prisma as any).auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: limit, skip }),
      (prisma as any).auditLog.count({ where }),
    ]);

    // Verify integrity of each record
    const verified = logs.map((log: any) => {
      let integrityOk = false;
      try {
        const expected = computeChecksum({
          action:    log.action,    resource:  log.resource,
          userId:    log.userId,    ip:        log.ip,
          timestamp: log.createdAt.toISOString(), payload: log.payload ?? "",
        });
        integrityOk = log.checksum === expected;
      } catch { integrityOk = false; }
      return { ...log, integrityOk };
    });

    return NextResponse.json({ data: verified, total, page, pages: Math.ceil(total / limit) });
  } catch (err: any) {
    if (err.message?.startsWith("[AUDIT]")) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Failed to fetch audit log." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  try {
    const { action, resource, userId, payload } = await req.json();
    if (!action || !resource) {
      return NextResponse.json({ error: "action and resource are required." }, { status: 400 });
    }

    // Always derive IP server-side - never trust client-supplied IP
    const ip = deriveIpFromRequest(req);

    const timestamp = new Date().toISOString();
    const checksum  = computeChecksum({
      action, resource,
      userId:  userId  ?? "system",
      ip,
      timestamp,
      payload: payload ?? "",
    });

    const entry = await (prisma as any).auditLog.create({
      data: { action, resource, userId: userId ?? "system", ip, payload: payload ?? "", checksum },
    });
    return NextResponse.json(entry, { status: 201 });
  } catch (err: any) {
    if (err.message?.startsWith("[AUDIT]")) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Failed to write audit log." }, { status: 500 });
  }
}
