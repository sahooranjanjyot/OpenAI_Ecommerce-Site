import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-middleware";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/metrics — Prometheus-compatible metrics (G-118)
 *
 * Exposes operational metrics in Prometheus text format.
 * Restricted to admin or internal monitoring (Bearer token from METRICS_TOKEN env var).
 * Compatible with Prometheus scrape config:
 *   - job_name: groceryos
 *     metrics_path: /api/metrics
 *     bearer_token: <METRICS_TOKEN>
 */

const startTime = Date.now();

// In-process counters (reset on restart; use Redis for persistence in production)
export const counters = {
  httpRequests:     0,
  checkoutAttempts: 0,
  checkoutSuccess:  0,
  checkoutFailed:   0,
  authLoginAttempts:0,
  authLoginFailed:  0,
  emailSent:        0,
  emailFailed:      0,
};

function isAuthorised(req: Request): boolean {
  // Option 1: Admin JWT
  const adminErr = requireAdmin(req);
  if (!adminErr) return true;

  // Option 2: Dedicated metrics bearer token (for Prometheus scraper)
  const metricsToken = process.env.METRICS_TOKEN;
  if (metricsToken) {
    const auth = req.headers.get("authorization");
    if (auth === `Bearer ${metricsToken}`) return true;
  }

  return false;
}

function gauge(name: string, value: number, labels?: Record<string, string>): string {
  const labelStr = labels
    ? `{${Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(",")}}`
    : "";
  return `${name}${labelStr} ${value}`;
}

function counter(name: string, value: number, help: string): string {
  return `# HELP ${name} ${help}\n# TYPE ${name} counter\n${name} ${value}`;
}

export async function GET(req: Request) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  try {
    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

    // DB stats
    const [orderCount, customerCount, productCount, lowStockCount] = await Promise.all([
      prisma.order.count(),
      prisma.customer.count(),
      prisma.product.count(),
      prisma.product.count({ where: { stock: { lte: 10 }, enabled: true } }),
    ]);

    const [ordersByStatus] = await Promise.all([
      prisma.order.groupBy({ by: ["status"], _count: { id: true } }),
    ]);

    const lines: string[] = [];

    // ── Uptime ──
    lines.push(`# HELP groceryos_uptime_seconds Time since last process start`);
    lines.push(`# TYPE groceryos_uptime_seconds gauge`);
    lines.push(gauge("groceryos_uptime_seconds", uptimeSeconds));

    // ── DB entity counts ──
    lines.push(`# HELP groceryos_total_orders Total orders in the database`);
    lines.push(`# TYPE groceryos_total_orders gauge`);
    lines.push(gauge("groceryos_total_orders", orderCount));

    lines.push(`# HELP groceryos_total_customers Total customers`);
    lines.push(`# TYPE groceryos_total_customers gauge`);
    lines.push(gauge("groceryos_total_customers", customerCount));

    lines.push(`# HELP groceryos_total_products Total products`);
    lines.push(`# TYPE groceryos_total_products gauge`);
    lines.push(gauge("groceryos_total_products", productCount));

    lines.push(`# HELP groceryos_low_stock_products Products with stock <= 10`);
    lines.push(`# TYPE groceryos_low_stock_products gauge`);
    lines.push(gauge("groceryos_low_stock_products", lowStockCount));

    // ── Orders by status ──
    lines.push(`# HELP groceryos_orders_by_status Orders broken down by status`);
    lines.push(`# TYPE groceryos_orders_by_status gauge`);
    for (const row of ordersByStatus) {
      lines.push(gauge("groceryos_orders_by_status", row._count.id, { status: row.status }));
    }

    // ── Application counters ──
    lines.push(counter("groceryos_http_requests_total", counters.httpRequests, "Total HTTP requests handled"));
    lines.push(counter("groceryos_checkout_attempts_total", counters.checkoutAttempts, "Total checkout attempts"));
    lines.push(counter("groceryos_checkout_success_total", counters.checkoutSuccess,  "Successful checkouts"));
    lines.push(counter("groceryos_checkout_failed_total",  counters.checkoutFailed,   "Failed checkouts"));
    lines.push(counter("groceryos_auth_attempts_total",    counters.authLoginAttempts, "Login attempts"));
    lines.push(counter("groceryos_auth_failed_total",      counters.authLoginFailed,   "Failed login attempts"));
    lines.push(counter("groceryos_email_sent_total",       counters.emailSent,  "Emails sent successfully"));
    lines.push(counter("groceryos_email_failed_total",     counters.emailFailed, "Email send failures"));

    // ── Node.js process metrics ──
    const memMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    lines.push(`# HELP groceryos_heap_used_mb Heap memory used in MB`);
    lines.push(`# TYPE groceryos_heap_used_mb gauge`);
    lines.push(gauge("groceryos_heap_used_mb", memMB));

    return new NextResponse(lines.join("\n") + "\n", {
      status: 200,
      headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" },
    });

  } catch (err: any) {
    console.error("[METRICS ERROR]", err.message);
    return NextResponse.json({ error: "Failed to collect metrics." }, { status: 500 });
  }
}
