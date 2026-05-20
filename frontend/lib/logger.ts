/**
 * Structured Logging (GAP-136 — ISO 25010 Maintainability)
 * JSON structured logs with correlation IDs, levels, source tagging
 * Drop-in for Winston / Pino in production
 */

type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

interface LogContext {
  correlationId?: string;
  userId?:        string;
  requestId?:     string;
  ip?:            string;
  path?:          string;
  method?:        string;
  statusCode?:    number;
  durationMs?:    number;
  orderId?:       number;
  [key: string]:  any;
}

const LEVEL_NUM: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40, fatal: 50 };
const MIN_LEVEL = (process.env.LOG_LEVEL ?? "info") as LogLevel;

function log(level: LogLevel, message: string, context: LogContext = {}) {
  if (LEVEL_NUM[level] < LEVEL_NUM[MIN_LEVEL]) return;

  const entry = {
    ts:        new Date().toISOString(),
    level,
    message,
    service:   "groceryos-api",
    env:       process.env.NODE_ENV ?? "development",
    version:   "1.0.0",
    ...context,
  };

  const serialized = JSON.stringify(entry);

  switch (level) {
    case "debug": console.debug(serialized); break;
    case "info":  console.info(serialized);  break;
    case "warn":  console.warn(serialized);  break;
    case "error":
    case "fatal": console.error(serialized); break;
  }

  // In production: send to Datadog/Logstash/CloudWatch
  // if (level === "error" || level === "fatal") alertSlack(entry);
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => log("debug", msg, ctx),
  info:  (msg: string, ctx?: LogContext) => log("info",  msg, ctx),
  warn:  (msg: string, ctx?: LogContext) => log("warn",  msg, ctx),
  error: (msg: string, ctx?: LogContext) => log("error", msg, ctx),
  fatal: (msg: string, ctx?: LogContext) => log("fatal", msg, ctx),

  // ── HTTP request logger ───────────────────────────────────────────────────
  request: (req: Request, status: number, durationMs: number) => {
    const url = new URL(req.url);
    log("info", `${req.method} ${url.pathname} ${status}`, {
      method:      req.method,
      path:        url.pathname,
      statusCode:  status,
      durationMs,
      ip:          req.headers.get("x-forwarded-for") ?? "unknown",
      userAgent:   req.headers.get("user-agent")?.slice(0, 100),
    });
  },

  // ── Payment event logger ──────────────────────────────────────────────────
  payment: (event: string, amount: number, currency: string, ctx?: LogContext) => {
    log("info", `PAYMENT_EVENT:${event}`, { event, amount, currency, category: "payment", ...ctx });
  },

  // ── Security event logger ──────────────────────────────────────────────────
  security: (event: string, severity: "low" | "medium" | "high" | "critical", ctx?: LogContext) => {
    const level: LogLevel = severity === "critical" ? "fatal" : severity === "high" ? "error" : "warn";
    log(level, `SECURITY_EVENT:${event}`, { event, severity, category: "security", ...ctx });
  },

  // ── Performance logger ────────────────────────────────────────────────────
  // ── Audit event logger (G-017, PCI-DSS 10.x, GDPR Art. 30) ─────────────────
  audit: (action: string, ctx?: LogContext & { actor?: string; resource?: string; ip?: string }) => {
    log("info", `AUDIT:${action}`, { action, category: "audit", ...ctx });
  },
};

// ── Request correlation middleware helper ─────────────────────────────────────
export function getCorrelationId(req: Request): string {
  return req.headers.get("x-correlation-id") ??
         req.headers.get("x-request-id") ??
         `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}
