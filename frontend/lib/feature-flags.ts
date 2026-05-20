/**
 * Feature Flag System (GAP-135 — ISO 25010 Maintainability)
 * Gradual rollouts, A/B flag overrides, kill switches
 * Reads from env vars or remote config — no redeploy needed
 */

type FlagValue = boolean | string | number;

interface FlagDefinition {
  key:         string;
  description: string;
  default:     FlagValue;
  rollout?:    number; // 0–100 % of users
  envVar?:     string;
}

const FLAGS: FlagDefinition[] = [
  { key: "crypto_payments",     description: "Enable Coinbase crypto payment option",        default: false, envVar: "FLAG_CRYPTO_PAYMENTS",     rollout: 0 },
  { key: "ar_viewer",           description: "Show AR viewer button on product pages",       default: false, envVar: "FLAG_AR_VIEWER",            rollout: 10 },
  { key: "chatbot",             description: "Enable AI shopping assistant widget",          default: true,  envVar: "FLAG_CHATBOT",              rollout: 100 },
  { key: "layaway",             description: "Show layaway/instalment payment option",       default: false, envVar: "FLAG_LAYAWAY",              rollout: 50 },
  { key: "b2b_portal",          description: "Show B2B wholesale application form",         default: false, envVar: "FLAG_B2B_PORTAL",           rollout: 0 },
  { key: "flash_sales_banner",  description: "Show flash sale countdown banner on home",    default: true,  envVar: "FLAG_FLASH_SALES_BANNER",   rollout: 100 },
  { key: "loyalty_v2",          description: "New tiered loyalty dashboard UI",             default: false, envVar: "FLAG_LOYALTY_V2",           rollout: 25 },
  { key: "dynamic_pricing",     description: "Enable ML-based dynamic price adjustments",   default: false, envVar: "FLAG_DYNAMIC_PRICING",      rollout: 0 },
  { key: "new_checkout",        description: "Redesigned one-page checkout",                default: false, envVar: "FLAG_NEW_CHECKOUT",         rollout: 20 },
  { key: "subscription_box",    description: "Enable monthly grocery box subscriptions",    default: true,  envVar: "FLAG_SUBSCRIPTION_BOX",     rollout: 100 },
];

// ── Deterministic user assignment (hash-based, not random) ────────────────────
function userInRollout(userId: string, flagKey: string, rolloutPct: number): boolean {
  if (rolloutPct <= 0)   return false;
  if (rolloutPct >= 100) return true;
  const hash = Array.from(`${flagKey}:${userId}`).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
  return (Math.abs(hash) % 100) < rolloutPct;
}

export const featureFlags = {
  // ── Check if flag is enabled for a given user ─────────────────────────────
  isEnabled(key: string, userId = "anonymous"): boolean {
    const def = FLAGS.find(f => f.key === key);
    if (!def) return false;

    // Environment variable override
    if (def.envVar && process.env[def.envVar] !== undefined) {
      return process.env[def.envVar] === "true" || process.env[def.envVar] === "1";
    }

    // Rollout-based
    if (typeof def.rollout === "number") {
      return userInRollout(userId, key, def.rollout);
    }

    return Boolean(def.default);
  },

  // ── Get string/number flag value ──────────────────────────────────────────
  getValue(key: string, userId = "anonymous"): FlagValue {
    const def = FLAGS.find(f => f.key === key);
    if (!def) return false;
    if (def.envVar && process.env[def.envVar] !== undefined) return process.env[def.envVar]!;
    return def.default;
  },

  // ── Get all flags (admin view) ────────────────────────────────────────────
  getAll(userId = "anonymous"): Record<string, { enabled: boolean; description: string; rollout?: number }> {
    return Object.fromEntries(
      FLAGS.map(f => [f.key, { enabled: this.isEnabled(f.key, userId), description: f.description, rollout: f.rollout }])
    );
  },
};

// ── API route: GET /api/flags?userId=X ────────────────────────────────────────
// Used by client to fetch flags on boot (replaces runtime env checks)
export function getFlagsForClient(userId: string) {
  return FLAGS.reduce((acc, f) => {
    acc[f.key] = featureFlags.isEnabled(f.key, userId);
    return acc;
  }, {} as Record<string, boolean>);
}
