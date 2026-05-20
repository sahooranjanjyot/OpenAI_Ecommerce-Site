#!/usr/bin/env node
/**
 * GroceryOS — Production Environment Variable Validator
 * FIXED LOW: Validates all required env vars at startup (fail-fast before
 *   the server accepts any traffic with missing secrets).
 *
 * Run: node scripts/env-check.js
 * Or add to package.json scripts: "env:check": "node scripts/env-check.js"
 */

const REQUIRED_VARS = [
  { key: "DATABASE_URL",      format: /^postgresql?:\/\/.+:\d+\/.+/, desc: "PostgreSQL connection string" },
  { key: "JWT_SECRET",        minLen: 32,  desc: "JWT signing secret (min 32 chars)" },
  { key: "CSRF_SECRET",       minLen: 32,  desc: "CSRF HMAC secret (min 32 chars)" },
  { key: "ADMIN_PASS_HASH",   format: /^\$2[ayb]\$\d+\$/, desc: "bcrypt hash of admin password ($2b$...)" },
  { key: "ADMIN_API_TOKEN",   minLen: 32,  desc: "Machine-to-machine admin API token (min 32 chars)" },
];

const PRODUCTION_REQUIRED = [
  { key: "REDIS_URL",         format: /^redis(s)?:\/\//, desc: "Redis connection (rediss:// for TLS in prod)" },
  { key: "STRIPE_SECRET_KEY", format: /^sk_(live|test)_/, desc: "Stripe secret key" },
];

const OPTIONAL_WARNED = [
  { key: "RESEND_API_KEY",   desc: "Email sending (Resend)" },
  { key: "TWILIO_AUTH_TOKEN",desc: "SMS notifications (Twilio)" },
  { key: "NEXT_PUBLIC_VAPID_PUBLIC_KEY", desc: "Web push notifications" },
];

function check() {
  const isProd = process.env.NODE_ENV === "production";
  const errors  = [];
  const warnings = [];

  console.log(`\n🔍 GroceryOS Environment Check (NODE_ENV=${process.env.NODE_ENV ?? "development"})\n`);

  // Required in all environments
  for (const { key, format, minLen, desc } of REQUIRED_VARS) {
    const val = process.env[key];
    if (!val) {
      errors.push(`  ❌ MISSING: ${key} — ${desc}`);
      continue;
    }
    if (minLen && val.length < minLen) {
      errors.push(`  ❌ TOO SHORT: ${key} must be ≥${minLen} chars (got ${val.length}) — ${desc}`);
      continue;
    }
    if (format && !format.test(val)) {
      errors.push(`  ❌ INVALID FORMAT: ${key} — expected ${format} — ${desc}`);
      continue;
    }
    // Security checks
    if (key === "JWT_SECRET" && (val === "dev-secret" || val === "changeme" || val.length < 32)) {
      errors.push(`  ❌ INSECURE: ${key} — must not use default value in production`);
    }
    if (key === "ADMIN_PASS_HASH" && val.startsWith("CHANGEME")) {
      errors.push(`  ❌ INSECURE: ${key} — still using placeholder value`);
    }
    console.log(`  ✅ ${key}`);
  }

  // Required in production
  if (isProd) {
    for (const { key, format, desc } of PRODUCTION_REQUIRED) {
      const val = process.env[key];
      if (!val) {
        errors.push(`  ❌ MISSING (PROD): ${key} — ${desc}`);
        continue;
      }
      if (format && !format.test(val)) {
        errors.push(`  ❌ INVALID FORMAT (PROD): ${key} — expected ${format} — ${desc}`);
        continue;
      }
      // Warn if Redis is not TLS in prod
      if (key === "REDIS_URL" && !val.startsWith("rediss://")) {
        warnings.push(`  ⚠️  SECURITY: REDIS_URL uses redis:// (non-TLS). Use rediss:// in production.`);
      }
      // Warn if using test Stripe keys in prod
      if (key === "STRIPE_SECRET_KEY" && val.includes("_test_")) {
        warnings.push(`  ⚠️  SECURITY: STRIPE_SECRET_KEY appears to be a test key in production.`);
      }
      console.log(`  ✅ ${key}`);
    }
  }

  // Optional with warnings
  for (const { key, desc } of OPTIONAL_WARNED) {
    if (!process.env[key]) {
      warnings.push(`  ⚠️  OPTIONAL NOT SET: ${key} — ${desc} will be unavailable`);
    } else {
      console.log(`  ✅ ${key} (optional)`);
    }
  }

  // Report
  if (warnings.length) {
    console.log(`\n⚠️  Warnings (${warnings.length}):`);
    warnings.forEach(w => console.log(w));
  }

  if (errors.length) {
    console.error(`\n❌ FATAL: ${errors.length} required environment variable(s) missing or invalid:`);
    errors.forEach(e => console.error(e));
    console.error(`\nSee .env.example for required values and formats.\n`);
    process.exit(1);
  }

  console.log(`\n✅ All required environment variables validated.\n`);
}

check();
