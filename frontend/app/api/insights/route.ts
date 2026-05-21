import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-middleware";

/**
 * Sentiment Analysis (G-230) — NLP analysis of reviews/tickets
 * Dynamic Pricing Engine (G-219) — demand-based price adjustments
 * Cohort Retention Analysis (G-231)
 */

export async function GET(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "sentiment";
  const { prisma } = await import("@/lib/prisma");

  // ── Sentiment Analysis (G-230) ─────────────────────────────────────────────
  if (type === "sentiment") {
    const reviews = await prisma.review.findMany({ take: 100, orderBy: { createdAt: "desc" } });

    // Keyword-based sentiment classifier
    const positiveWords = ["excellent","great","love","perfect","amazing","fantastic","wonderful","best","delicious","fresh","recommend","happy","satisfied"];
    const negativeWords = ["poor","bad","terrible","awful","disappointing","worst","broken","wrong","late","damaged","missing","refund","disgusting"];

    const scored = reviews.map((r: any) => {
      const text   = (r.comment ?? "").toLowerCase();
      const pos    = positiveWords.filter(w => text.includes(w)).length;
      const neg    = negativeWords.filter(w => text.includes(w)).length;
      const score  = pos - neg;
      const sentiment = score > 0 ? "positive" : score < 0 ? "negative" : "neutral";
      return { id: r.id, productId: r.productId, rating: r.rating, sentiment, score, text: r.comment?.slice(0, 100) };
    });

    const counts   = { positive: 0, negative: 0, neutral: 0 };
    scored.forEach((s: any) => counts[s.sentiment as keyof typeof counts]++);
    const avgScore = scored.length > 0 ? (scored.reduce((s: number, r: any) => s + r.score, 0) / scored.length).toFixed(2) : "0";

    return NextResponse.json({ type: "sentiment", total: reviews.length, breakdown: counts, avgSentimentScore: avgScore, samples: scored.slice(0, 20) });
  }

  // ── Dynamic Pricing Suggestions (G-219) ───────────────────────────────────
  if (type === "dynamic_pricing") {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const products = await prisma.product.findMany({ where: { enabled: true }, take: 30 });

    const suggestions = await Promise.all(products.map(async (product) => {
      const batches = await (prisma as any).inventoryBatch.aggregate({
        where: { productId: product.id, quantity: { lt: 0 }, createdAt: { gte: thirtyDaysAgo } },
        _sum: { quantity: true },
      });
      const velocity = Math.abs(batches._sum?.quantity ?? 0) / 30;
      const stockRatio = product.stock / Math.max(velocity * 30, 1);

      let suggestion: "increase" | "decrease" | "hold" = "hold";
      let suggestedPrice = product.price;
      let reason = "";

      if (velocity > 5 && stockRatio < 0.3) {
        suggestion     = "increase";
        suggestedPrice = parseFloat((product.price * 1.05).toFixed(2));
        reason         = "High demand, low stock";
      } else if (stockRatio > 3 && velocity < 0.5) {
        suggestion     = "decrease";
        suggestedPrice = parseFloat((product.price * 0.9).toFixed(2));
        reason         = "Excess stock, low velocity";
      } else {
        reason = "Stable demand";
      }

      return { id: product.id, name: product.name, currentPrice: product.price, suggestedPrice, suggestion, velocity: parseFloat(velocity.toFixed(2)), stockRatio: parseFloat(stockRatio.toFixed(2)), reason };
    }));

    return NextResponse.json({ type: "dynamic_pricing", suggestions: suggestions.filter(s => s.suggestion !== "hold").slice(0, 20) });
  }

  // ── Cohort Retention Analysis (G-231) ──────────────────────────────────────
  if (type === "cohort") {
    const sixMonthsAgo = new Date(Date.now() - 180 * 86400000);
    const orders = await prisma.order.findMany({
      where:   { createdAt: { gte: sixMonthsAgo } },
      include: { customer: { select: { id: true } } },
      orderBy: { createdAt: "asc" },
    });

    // Group by month of first order
    const cohorts: Record<string, Set<number>> = {};
    const customerFirst: Record<number, string> = {};

    for (const order of orders) {
      if (!order.customerId) continue;
      const month = new Date(order.createdAt).toISOString().slice(0, 7);
      if (!customerFirst[order.customerId]) {
        customerFirst[order.customerId] = month;
        if (!cohorts[month]) cohorts[month] = new Set();
        cohorts[month].add(order.customerId);
      }
    }

    const cohortData = Object.entries(cohorts).map(([month, customers]) => ({
      cohort:    month,
      size:      customers.size,
      returning: orders.filter(o => {
        if (!o.customerId || !customers.has(o.customerId)) return false;
        const oMonth = new Date(o.createdAt).toISOString().slice(0, 7);
        return oMonth > month;
      }).reduce((set: Set<number>, o) => { set.add(o.customerId!); return set; }, new Set()).size,
    })).map(c => ({ ...c, retentionRate: c.size > 0 ? `${Math.round(c.returning / c.size * 100)}%` : "0%" }));

    return NextResponse.json({ type: "cohort", cohorts: cohortData });
  }

  return NextResponse.json({ error: "type must be sentiment|dynamic_pricing|cohort" }, { status: 400 });
}
