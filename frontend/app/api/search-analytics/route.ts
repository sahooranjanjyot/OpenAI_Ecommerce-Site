import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-middleware";

/**
 * Search Analytics (G-115) — track searches, zero-result queries, popular terms
 * Fraud Detection (G-139) — risk scoring for orders
 * Promotion Management (G-132) — combined discount scheduling
 */

// ── In-memory search analytics ────────────────────────────────────────────────
const searchLog: Array<{ q: string; results: number; sessionId: string; ts: number }> = [];

// ── GET /api/search-analytics — admin dashboard ───────────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type    = searchParams.get("type") ?? "search";
  const authErr = requireAdmin(req);

  if (type === "search") {
    if (authErr) return authErr;

    const total    = searchLog.length;
    const zeroRes  = searchLog.filter(s => s.results === 0);
    const termFreq: Record<string, number> = {};
    for (const s of searchLog) termFreq[s.q] = (termFreq[s.q] ?? 0) + 1;
    const topTerms = Object.entries(termFreq).sort((a, b) => b[1] - a[1]).slice(0, 20);
    const zeroTerms = zeroRes.reduce((acc: Record<string, number>, s) => { acc[s.q] = (acc[s.q] ?? 0) + 1; return acc; }, {});

    return NextResponse.json({
      totalSearches:    total,
      zeroResultRate:   total > 0 ? `${Math.round(zeroRes.length / total * 100)}%` : "0%",
      topSearchTerms:   topTerms,
      zeroResultTerms:  Object.entries(zeroTerms).sort((a, b) => b[1] - a[1]).slice(0, 10),
      recentSearches:   searchLog.slice(-20).reverse(),
    });
  }

  if (type === "fraud") {
    if (authErr) return authErr;
    // Fraud detection report
    const { prisma } = await import("@/lib/prisma");
    const orders = await prisma.order.findMany({
      where:   { status: { not: "cancelled" }, total: { gt: 100 } },
      include: { customer: { select: { email: true, createdAt: true } } },
      orderBy: { createdAt: "desc" },
      take:    50,
    });

    const riskScored = orders.map((o: any) => {
      let risk = 0;
      const reasons: string[] = [];
      if (o.total > 200) { risk += 20; reasons.push("high_value"); }
      if (o.total > 500) { risk += 30; reasons.push("very_high_value"); }
      const accAge = o.customer ? Math.floor((Date.now() - new Date(o.customer.createdAt).getTime()) / 86400000) : 999;
      if (accAge < 1)   { risk += 40; reasons.push("new_account"); }
      if (accAge < 7)   { risk += 20; reasons.push("young_account"); }
      return { orderId: o.id, total: o.total, risk, reasons, level: risk >= 60 ? "HIGH" : risk >= 30 ? "MEDIUM" : "LOW" };
    });

    return NextResponse.json({
      analysed:     riskScored.length,
      highRisk:     riskScored.filter(r => r.level === "HIGH").length,
      mediumRisk:   riskScored.filter(r => r.level === "MEDIUM").length,
      orders:       riskScored.filter(r => r.level !== "LOW"),
    });
  }

  return NextResponse.json({ error: "type must be search|fraud" }, { status: 400 });
}

// ── POST /api/search-analytics — track search event ──────────────────────────
export async function POST(req: Request) {
  try {
    const { q, results, sessionId } = await req.json();
    if (!q) return NextResponse.json({ ok: false });
    searchLog.push({ q: q.toLowerCase().trim(), results: results ?? 0, sessionId: sessionId ?? "anon", ts: Date.now() });
    if (searchLog.length > 5000) searchLog.shift();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
