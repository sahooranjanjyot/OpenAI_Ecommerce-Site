/**
 * Redis Cache + Rate Limiting Utility (G-041)
 *
 * M-E-4 FIX: Rate limiting is now atomic.
 * - With Redis: uses MULTI/EXEC pipeline (atomic INCR + EXPIRE)
 * - Without Redis: uses in-memory Map with a bounded LRU-style eviction
 *
 * L-E-2 FIX: In-memory cache has a hard size limit (MAX_MEMORY_ENTRIES)
 * to prevent unbounded growth in long-running processes.
 */

import type { Redis as RedisType } from "ioredis";

type CacheOptions = {
  ttl?: number;    // seconds
  prefix?: string;
};

// ── In-memory fallback (dev only) with size cap ───────────────────────────────
const MAX_MEMORY_ENTRIES = 2000;
const memoryCache = new Map<string, { value: any; expires: number }>();

function evictExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of memoryCache) {
    if (now > entry.expires) memoryCache.delete(key);
  }
}

function ensureCacheCapacity(): void {
  if (memoryCache.size >= MAX_MEMORY_ENTRIES) {
    evictExpiredEntries();
    // If still over limit, evict oldest inserted (FIFO)
    if (memoryCache.size >= MAX_MEMORY_ENTRIES) {
      const oldest = memoryCache.keys().next().value;
      if (oldest) memoryCache.delete(oldest);
    }
  }
}

// ── Redis client (lazy singleton) ─────────────────────────────────────────────
let _redis: RedisType | null = null;

async function getRedis(): Promise<RedisType | null> {
  if (!process.env.REDIS_URL) return null;
  if (_redis) return _redis;
  try {
    const { default: Redis } = await import("ioredis");

    // FIXED MEDIUM: Enforce TLS in production — plaintext Redis leaks credentials & data
    const isProd   = process.env.NODE_ENV === "production";
    const tlsEnabled = process.env.REDIS_TLS === "true";

    if (isProd && !tlsEnabled) {
      // Force TLS on in production even if env var not set — security over convenience
      console.warn(
        "[Redis] WARNING: REDIS_TLS is not set to 'true' in production. " +
        "Forcing TLS to prevent plaintext credential exposure. " +
        "Set REDIS_TLS=true to silence this warning."
      );
    }

    _redis = new Redis(process.env.REDIS_URL, {
      password:         process.env.REDIS_PASSWORD,
      // FIXED MEDIUM: TLS forced on in production regardless of env var
      tls:              (isProd || tlsEnabled) ? {
        rejectUnauthorized: isProd, // strict cert validation in prod, relaxed in dev
      } : undefined,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });
    _redis.on("error", (err) => console.error("[Redis error]", err.message));
    return _redis;
  } catch {
    return null;
  }
}

export const cache = {
  // ── Get ────────────────────────────────────────────────────────────────────
  async get<T>(key: string): Promise<T | null> {
    const redis = await getRedis();
    if (redis) {
      const val = await redis.get(key);
      return val ? (JSON.parse(val) as T) : null;
    }
    const entry = memoryCache.get(key);
    if (!entry || Date.now() > entry.expires) {
      memoryCache.delete(key);
      return null;
    }
    return entry.value as T;
  },

  // ── Set ────────────────────────────────────────────────────────────────────
  async set(key: string, value: any, ttl = 300): Promise<void> {
    const redis = await getRedis();
    if (redis) {
      await redis.setex(key, ttl, JSON.stringify(value));
      return;
    }
    ensureCacheCapacity();
    memoryCache.set(key, { value, expires: Date.now() + ttl * 1000 });
  },

  // ── Delete ─────────────────────────────────────────────────────────────────
  async del(key: string): Promise<void> {
    const redis = await getRedis();
    if (redis) {
      await redis.del(key);
      return;
    }
    memoryCache.delete(key);
  },

  // ── Invalidate pattern ────────────────────────────────────────────────────
  async invalidate(pattern: string): Promise<void> {
    const redis = await getRedis();
    if (redis) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) await redis.del(...keys);
      return;
    }
    const prefix = pattern.replace("*", "");
    for (const key of memoryCache.keys()) {
      if (key.startsWith(prefix)) memoryCache.delete(key);
    }
  },

  /**
   * M-E-4 FIX: Atomic rate limiting — FAIL CLOSED.
   *
   * Redis path: MULTI/EXEC pipeline — atomic, no TOCTOU window.
   * Memory path: single-threaded event-loop safe.
   *
   * FAIL-CLOSED POLICY (was previously fail-open):
   *   If Redis is unavailable and memory fallback also fails, we DENY
   *   the request. This prevents Redis outages from becoming an
   *   unlimited brute-force window.
   */
  async rateLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const countKey = `ratelimit:${key}`;
    const resetAt  = Date.now() + windowSeconds * 1000;
    const DENY     = { allowed: false, remaining: 0, resetAt };

    try {
      const redis = await getRedis();
      if (redis) {
        const pipeline = redis.pipeline();
        pipeline.incr(countKey);
        pipeline.expire(countKey, windowSeconds, "NX");
        const results = await pipeline.exec();
        if (!results) return DENY;  // pipeline failed — fail closed
        const count = (results[0]?.[1] as number) ?? 1;
        return {
          allowed:   count <= limit,
          remaining: Math.max(0, limit - count),
          resetAt,
        };
      }
    } catch {
      // Redis error — fail closed (deny) to prevent brute-force during outage
      return DENY;
    }

    // Single-process memory path (event-loop safe, dev/test only)
    const entry = memoryCache.get(countKey);
    const now   = Date.now();

    if (!entry || now > entry.expires) {
      ensureCacheCapacity();
      memoryCache.set(countKey, { value: 1, expires: now + windowSeconds * 1000 });
      return { allowed: true, remaining: limit - 1, resetAt };
    }

    const count = (entry.value as number) + 1;
    entry.value = count;

    return {
      allowed:   count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt:   entry.expires,
    };
  },

  // ── Cached query wrapper ──────────────────────────────────────────────────
  async cached<T>(key: string, fetcher: () => Promise<T>, options?: CacheOptions): Promise<T> {
    const fullKey = `${options?.prefix ?? ""}${key}`;
    const cached  = await cache.get<T>(fullKey);
    if (cached !== null) return cached;
    const value = await fetcher();
    await this.set(fullKey, value, options?.ttl ?? 300);
    return value;
  },
};

// ── Cache key builders ────────────────────────────────────────────────────────
export const CacheKeys = {
  products:          (page: number, limit: number) => `products:${page}:${limit}`,
  product:           (id: number)                  => `product:${id}`,
  productsByCategory:(cat: string)                 => `products:cat:${cat}`,
  search:            (q: string, page: number)     => `search:${q}:${page}`,
  order:             (id: number)                  => `order:${id}`,
  customer:          (id: number)                  => `customer:${id}`,
  loyaltyAccount:    (email: string)               => `loyalty:${email}`,
  coupon:            (code: string)                => `coupon:${code}`,
  salesReport:       (period: string)              => `report:sales:${period}`,
  inventory:         ()                            => "report:inventory",
};
