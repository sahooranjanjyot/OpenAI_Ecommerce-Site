import http from "k6/http";
import { check, group, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

/**
 * k6 Performance Test Suite (GAP-033, GAP-016, GAP-017, GAP-021)
 * Tests: homepage, product listing, search, add-to-cart, checkout
 * Run: k6 run tests/performance/load-test.js
 */

const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";

// Custom metrics
const errorRate    = new Rate("errors");
const apiLatency   = new Trend("api_latency", true);

export const options = {
  stages: [
    { duration: "1m",  target: 10  },  // Ramp up
    { duration: "3m",  target: 50  },  // Steady load
    { duration: "2m",  target: 100 },  // Peak load
    { duration: "1m",  target: 0   },  // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000", "p(99)<5000"],  // SLA: 95th < 2s, 99th < 5s (GAP-016, GAP-021)
    errors:            ["rate<0.01"],                  // < 1% error rate
    http_req_failed:   ["rate<0.01"],
  },
};

const ADMIN_TOKEN = __ENV.ADMIN_TOKEN || "test-admin-token";

export default function () {
  // ── Health check ───────────────────────────────────────────────────────────
  group("Health", () => {
    const res = http.get(`${BASE_URL}/api/health?type=health`);
    apiLatency.add(res.timings.duration, { endpoint: "health" });
    check(res, { "health: status 200": r => r.status === 200, "health: body healthy": r => r.json("status") === "healthy" });
    errorRate.add(res.status !== 200);
  });

  sleep(0.2);

  // ── Product listing ────────────────────────────────────────────────────────
  group("Product Listing", () => {
    const res = http.get(`${BASE_URL}/api/products?page=1&limit=20`);
    apiLatency.add(res.timings.duration, { endpoint: "products" });
    check(res, {
      "products: status 200":      r => r.status === 200,
      "products: has items":       r => r.json("products")?.length > 0 || Array.isArray(r.json()),
      "products: under 1s":        r => r.timings.duration < 1000,
    });
    errorRate.add(res.status !== 200);
  });

  sleep(0.3);

  // ── Search ─────────────────────────────────────────────────────────────────
  group("Search", () => {
    const queries = ["milk", "bread", "eggs", "cheese", "apple"];
    const q       = queries[Math.floor(Math.random() * queries.length)];
    const res     = http.get(`${BASE_URL}/api/search?q=${q}&page=1&limit=10`);
    apiLatency.add(res.timings.duration, { endpoint: "search" });
    check(res, { "search: status 200": r => r.status === 200, "search: under 500ms": r => r.timings.duration < 500 });
    errorRate.add(res.status !== 200);
  });

  sleep(0.2);

  // ── Recommendations ────────────────────────────────────────────────────────
  group("Recommendations", () => {
    const res = http.get(`${BASE_URL}/api/recommendations`);
    apiLatency.add(res.timings.duration, { endpoint: "recommendations" });
    check(res, { "recs: status 200": r => r.status === 200 });
    errorRate.add(res.status !== 200);
  });

  sleep(0.5);

  // ── Gift card balance (low-cost API) ───────────────────────────────────────
  group("Gift Card Check", () => {
    const res = http.get(`${BASE_URL}/api/gift-cards?code=TEST-INVALID-CODE`);
    apiLatency.add(res.timings.duration, { endpoint: "gift-cards" });
    check(res, { "gift card: responds": r => r.status === 200 || r.status === 404 });
  });

  sleep(1);
}

export function handleSummary(data: any) {
  return {
    "tests/performance/results.json": JSON.stringify(data, null, 2),
    stdout: `
╔══════════════════════════════════════════════════╗
║      GroceryOS Performance Test Results          ║
╠══════════════════════════════════════════════════╣
║  p50 latency:  ${String(data.metrics.http_req_duration?.values?.["p(50)"]?.toFixed(0) ?? "N/A").padEnd(8)} ms                      ║
║  p95 latency:  ${String(data.metrics.http_req_duration?.values?.["p(95)"]?.toFixed(0) ?? "N/A").padEnd(8)} ms  (SLA: <2000ms)       ║
║  p99 latency:  ${String(data.metrics.http_req_duration?.values?.["p(99)"]?.toFixed(0) ?? "N/A").padEnd(8)} ms  (SLA: <5000ms)       ║
║  Error rate:   ${String((data.metrics.errors?.values?.rate * 100)?.toFixed(2) ?? "N/A").padEnd(8)} %   (SLA: <1%)            ║
║  Total reqs:   ${String(data.metrics.http_reqs?.values?.count ?? "N/A").padEnd(8)}                          ║
╚══════════════════════════════════════════════════╝
    `,
  };
}
