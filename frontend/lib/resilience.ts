/**
 * Circuit Breaker (GAP-073 — ISO 25010 Fault Tolerance)
 * Prevents cascade failures when external services are unavailable
 * States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing recovery)
 */

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CircuitConfig {
  failureThreshold:  number;  // failures before opening
  successThreshold:  number;  // successes to close from half-open
  timeout:           number;  // ms before retrying from OPEN
  monitorInterval?:  number;
}

export class CircuitBreaker {
  private state:          CircuitState = "CLOSED";
  private failureCount:   number = 0;
  private successCount:   number = 0;
  private lastFailureTime?: number;
  private readonly name:  string;
  private readonly cfg:   CircuitConfig;

  constructor(name: string, cfg: Partial<CircuitConfig> = {}) {
    this.name = name;
    this.cfg  = { failureThreshold: 5, successThreshold: 2, timeout: 60_000, ...cfg };
  }

  async execute<T>(fn: () => Promise<T>, fallback?: () => T): Promise<T> {
    if (this.state === "OPEN") {
      const elapsed = Date.now() - (this.lastFailureTime ?? 0);
      if (elapsed < this.cfg.timeout) {
        console.warn(`[CircuitBreaker:${this.name}] OPEN — using fallback`);
        if (fallback) return fallback();
        throw new Error(`Circuit OPEN for ${this.name}. Retry after ${Math.round((this.cfg.timeout - elapsed) / 1000)}s`);
      }
      this.state = "HALF_OPEN";
      this.successCount = 0;
      console.info(`[CircuitBreaker:${this.name}] HALF_OPEN — testing recovery`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      if (fallback && (this.state as string) === "OPEN") return fallback();
      throw err;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    if (this.state === "HALF_OPEN") {
      this.successCount++;
      if (this.successCount >= this.cfg.successThreshold) {
        this.state = "CLOSED";
        console.info(`[CircuitBreaker:${this.name}] CLOSED — service recovered`);
      }
    }
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.state === "HALF_OPEN" || this.failureCount >= this.cfg.failureThreshold) {
      this.state = "OPEN";
      console.error(`[CircuitBreaker:${this.name}] OPEN — ${this.failureCount} failures`);
    }
  }

  getStatus() {
    return {
      name:         this.name,
      state:        this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailure:  this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
    };
  }
}

// ── Retry with exponential backoff (GAP-081) ──────────────────────────────────
export async function withRetry<T>(
  fn:       () => Promise<T>,
  maxRetries = 3,
  baseDelay  = 500,
  label      = "operation"
): Promise<T> {
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const delay = baseDelay * 2 ** (attempt - 1) + Math.random() * 200;
      console.warn(`[Retry:${label}] Attempt ${attempt}/${maxRetries} failed. Retrying in ${Math.round(delay)}ms…`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr ?? new Error(`${label} failed after ${maxRetries} retries`);
}

// ── Idempotency key store (GAP-086) — Redis-backed for distributed safety ─────
// FIXED HIGH: In-memory Map is lost on restart and doesn't scale across
// multiple server instances. Now uses cache (Redis in prod, memory in dev).
import { cache } from "./cache";

export async function withIdempotency<T>(
  key:   string,
  ttlMs: number,
  fn:    () => Promise<T>
): Promise<{ result: T; duplicate: boolean }> {
  const cacheKey = `idempotency:${key}`;
  const ttlSec   = Math.ceil(ttlMs / 1000);

  // Check for existing result in Redis
  const existing = await cache.get<{ result: T; createdAt: number }>(cacheKey);
  if (existing && Date.now() - existing.createdAt < ttlMs) {
    return { result: existing.result, duplicate: true };
  }

  const result = await fn();
  // Store in Redis with TTL (auto-expires, no manual cleanup needed)
  await cache.set(cacheKey, { result, createdAt: Date.now() }, ttlSec * 2);
  return { result, duplicate: false };
}

// ── Pre-built circuit breakers for external services ──────────────────────────
export const breakers = {
  stripe:    new CircuitBreaker("stripe",    { failureThreshold: 3, timeout: 30_000 }),
  paypal:    new CircuitBreaker("paypal",    { failureThreshold: 3, timeout: 30_000 }),
  resend:    new CircuitBreaker("resend",    { failureThreshold: 5, timeout: 60_000 }),
  twilio:    new CircuitBreaker("twilio",    { failureThreshold: 3, timeout: 30_000 }),
  database:  new CircuitBreaker("database",  { failureThreshold: 10, timeout: 10_000 }),
};
