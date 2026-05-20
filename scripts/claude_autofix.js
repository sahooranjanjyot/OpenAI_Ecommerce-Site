#!/usr/bin/env node
/**
 * GroceryOS — Claude Auto-Fix Script
 * Option A+B: Full file visibility → Claude fixes → writes back to disk
 *
 * For each file with open issues, sends the FULL file content to Claude
 * with precise fix instructions. Claude returns the complete corrected file.
 * The script writes it back atomically.
 */

const https   = require("https");
const fs      = require("fs");
const path    = require("path");

const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL          = "claude-opus-4-5";
const ROOT           = path.resolve(__dirname, "..");
const API_DIR        = path.join(ROOT, "frontend/app/api");
const LIB_DIR        = path.join(ROOT, "frontend/lib");

// ── Helper: read a file helper ───────────────────────────────────────────────
function read(relPath) {
  const full = path.join(ROOT, "frontend", relPath);
  return { full, content: fs.readFileSync(full, "utf8") };
}

// ── Helper: Claude API call ───────────────────────────────────────────────────
function callClaude(systemPrompt, userMessage, maxTokens = 4096) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model:      MODEL,
      max_tokens: maxTokens,
      system:     systemPrompt,
      messages:   [{ role: "user", content: userMessage }],
    });
    const req = https.request({
      hostname: "api.anthropic.com",
      path:     "/v1/messages",
      method:   "POST",
      headers:  {
        "Content-Type":      "application/json",
        "x-api-key":         CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Length":    Buffer.byteLength(body),
      },
    }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end",  () => {
        try {
          const j = JSON.parse(data);
          if (j.error) return reject(new Error(`Claude: ${j.error.message}`));
          resolve(j.content?.[0]?.text ?? "");
        } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Helper: extract code block from Claude response ───────────────────────────
function extractCode(response) {
  // Try ```typescript or ```ts block first
  const tsBlock = response.match(/```(?:typescript|ts)\n([\s\S]*?)```/);
  if (tsBlock) return tsBlock[1];
  // Try generic ```
  const generic = response.match(/```\n([\s\S]*?)```/);
  if (generic) return generic[1];
  // If no fences, return full response (Claude sometimes returns clean code)
  return response.trim();
}

// ── Helper: fix one file ──────────────────────────────────────────────────────
async function fixFile(relPath, issues, extraContext = "") {
  const { full, content } = read(relPath);
  const label = relPath;

  console.log(`\n  🔧 Fixing: ${label}`);
  console.log(`     Issues: ${issues.slice(0,120)}...`);

  const SYSTEM = `You are a senior TypeScript/Next.js security engineer.
You will receive a file from the GroceryOS Next.js API codebase and a list of specific issues to fix.

RULES:
1. Return ONLY the complete, corrected file content — no explanation, no markdown prose.
2. Wrap the output in a single \`\`\`typescript code fence.
3. Fix ONLY the listed issues. Do not refactor unrelated code.
4. Preserve all existing comments and logic that is NOT related to the issues.
5. Use imports already present in the file; add new ones only if strictly necessary.
6. For Zod errors always use: (parsed.error as any).issues?.[0]?.message ?? "Invalid input"
7. For rate limiting use the cache.rateLimit() helper from "../../../lib/cache" (or correct relative path).
8. For auth use requireAdmin() or requireAuth() from the auth-middleware.
9. For audit logging use logger.audit() from lib/logger.
10. For atomic DB operations use prisma.$transaction() to prevent race conditions.

${extraContext}`;

  const userMsg = `FILE: ${label}

ISSUES TO FIX:
${issues}

CURRENT FILE CONTENT:
\`\`\`typescript
${content}
\`\`\`

Return the complete fixed file.`;

  let response;
  for (let retry = 0; retry < 3; retry++) {
    try {
      response = await callClaude(SYSTEM, userMsg, 4096);
      break;
    } catch (e) {
      if (retry === 2) throw e;
      await new Promise(r => setTimeout(r, 3000 * (retry + 1)));
      process.stdout.write(" ↺");
    }
  }

  const fixed = extractCode(response);
  if (!fixed || fixed.length < 100) {
    console.log(`  ⚠️  Skipping ${label} — Claude returned empty/short response`);
    return false;
  }

  // Backup original
  fs.writeFileSync(full + ".bak", content, "utf8");
  // Write fix
  fs.writeFileSync(full, fixed, "utf8");
  console.log(`  ✅ Written: ${label} (${fixed.length} chars)`);
  return true;
}

// ── ISSUE LIST — all 29 missing + top bugs ───────────────────────────────────
const FIXES = [
  {
    file: "lib/auth-middleware.ts",
    issues: `1. AUDIT_HMAC_SECRET has fallback "key" — must throw new Error() in production if env var missing (like JWT_SECRET does).
2. Ensure the module-level IIFE throws with a clear message: "AUDIT_HMAC_SECRET or JWT_SECRET env var required".`,
  },
  {
    file: "app/api/payments/split/route.ts",
    issues: `1. CRITICAL: requireAdmin is imported but never called. Add auth check at the top of POST handler: const authErr = requireAdmin(req); if (authErr) return authErr;
2. store_credit case is in the PaymentMethod enum but has no handler in the switch statement — add a case for it that processes store credit redemption (deduct from customer balance or return error if insufficient).
3. Remove unused import warnings if any.`,
  },
  {
    file: "app/api/pricing/route.ts",
    issues: `1. BUG: Dead code in GET handler — variables items, qty, total, orderItems are undefined (ReferenceError at runtime). Remove or fix this dead code block. If it's order-pricing logic that doesn't belong in the pricing GET endpoint, remove it entirely and keep only the price-lookup logic.
2. Ensure GET returns valid pricing data without runtime crashes.`,
  },
  {
    file: "app/api/gift-cards/route.ts",
    issues: `1. RACE CONDITION on gift card redemption: the current check-then-update pattern (findUnique → update) allows two concurrent requests to both pass the balance check and double-spend. Fix by using a prisma.$transaction with an atomic updateMany WHERE balance >= amount, checking if 0 rows affected means insufficient balance.`,
  },
  {
    file: "app/api/loyalty/route.ts",
    issues: `1. RACE CONDITION on loyalty points redemption: same check-then-update pattern allows double-spend. Fix using atomic prisma.$transaction: use updateMany with WHERE points >= pointsToUse, check affected count. If 0 rows → insufficient points error.`,
  },
  {
    file: "app/api/returns/route.ts",
    issues: `1. MISSING AUTH: GET handler has no authorization — anyone can read all return records. Add requireAdmin(req) to GET.
2. MISSING VALIDATION: POST has no Zod input validation. Add a ReturnSchema with z.object({ orderId: z.number().int().positive(), items: z.array(...), reason: z.string().min(1).max(500), condition: z.enum(["unopened","opened","damaged"]) }).
3. MISSING AUDIT: Add logger.audit("RETURN_CREATED", {...}) after successful return creation.
4. Add pagination to GET (take/skip, max 50 per page).`,
  },
  {
    file: "app/api/wishlist/route.ts",
    issues: `1. MISSING AUTH (IDOR): No authentication on GET/POST/DELETE — anyone can read or modify any user's wishlist by knowing their email. Add JWT-based auth: extract userId from session token; only allow access to own wishlist. For admin, allow all.
2. MISSING RATE LIMIT: Add rate limiting (20 mutations per IP per hour) on POST and DELETE.
3. MISSING CSRF: Note that CSRF is handled by middleware globally, but add a comment confirming this.`,
  },
  {
    file: "app/api/coupons/route.ts",
    issues: `1. BUG: Duplicate code block around lines 56-61 — the same return statement appears twice causing dead code or potential syntax error. Remove the duplicate.
2. Ensure GET returns properly paginated coupons.`,
  },
  {
    file: "app/api/blog/route.ts",
    issues: `1. BUG: In PUT handler, the check "if (data.published && !data.publishedAt)" is wrong — PutSchema.partial() does not include publishedAt, so data.publishedAt is always undefined. Fix by checking if the DB record does NOT already have publishedAt set: fetch the existing post first, then set publishedAt only if it was previously null/undefined and published is being set to true.`,
  },
  {
    file: "app/api/flash-sales/route.ts",
    issues: `1. BUG: JSON.parse(sale.productIds) is called without try/catch — malformed JSON in the database will crash the endpoint with an unhandled exception. Wrap in try/catch and skip/log invalid records.
2. Ensure the error is handled gracefully (return empty array for productIds if JSON invalid, log warning).`,
  },
  {
    file: "app/api/layaway/route.ts",
    issues: `1. MISSING RATE LIMIT: No rate limiting on layaway creation (inventory reservation DoS). Add cache.rateLimit on POST: 5 layaways per IP per hour.
2. BUG: Instalment rounding — remaining/(instalments-1) produces floating point errors (3x33.33=99.99 not 100). Fix by using Math.round() for each instalment and ensuring last instalment = total - sum(previous).
3. MISSING PAYMENT VERIFICATION: PUT handler trusts amountPaid from body — add a comment/TODO noting that in production this should be verified against a payment webhook, and for now validate amountPaid > 0 and <= outstanding amount.`,
  },
  {
    file: "app/api/notifications/backInStock/route.ts",
    issues: `1. MISSING AUTH: POST has no authentication — anyone can register any email for any product notification. Add JWT auth: require a valid session token, and only allow registering notifications for the authenticated user's own email.
2. MISSING RATE LIMIT: Add rate limiting (10 subscriptions per IP per hour) to prevent abuse.`,
  },
  {
    file: "app/api/qa/route.ts",
    issues: `1. MISSING RATE LIMIT on POST: No rate limiting on question submission — allows spam flooding. Add cache.rateLimit (5 questions per IP per 10 minutes).
2. MISSING AUTH on POST: Any anonymous user can submit questions. Add optional auth: if authenticated, attach userId; if not, require email field. Either way rate limit.`,
  },
  {
    file: "app/api/recently-viewed/route.ts",
    issues: `1. MISSING AUTH: POST has no authentication — anyone can record views for any email address (privacy violation). Require authentication; use the authenticated user's ID/email from session token, not client-supplied email.
2. MISSING RATE LIMIT: Add rate limiting (30 per IP per hour) on POST.
3. BUG: String contains check for productId — "contains: String(productId)" matches partial numbers (productId=1 matches "10", "21"). Fix by storing product IDs as proper array/JSON and parsing correctly, or use a more specific separator pattern.
4. MISSING PAGINATION: Add take/skip pagination on GET results (default 10, max 50).`,
  },
  {
    file: "app/api/subscriptions/route.ts",
    issues: `1. MISSING CSRF: State-changing POST/PUT/DELETE mutations have no explicit CSRF check. While middleware.ts handles CSRF globally, add a comment confirming this and ensure the endpoint does not have CSRF_EXEMPT in middleware config.
2. MISSING OWNERSHIP: Verify that subscription mutations are scoped to the authenticated user — a user should not be able to cancel another user's subscription. Add ownership check.`,
  },
  {
    file: "app/api/support/route.ts",
    issues: `1. MISSING VALIDATION: PUT handler accepts status, resolution, assignedTo, priority without Zod validation — mass assignment risk. Add a PutSupportSchema with: status: z.enum(["open","in_progress","resolved","closed"]), resolution: z.string().max(2000).optional(), assignedTo: z.string().max(100).optional(), priority: z.enum(["low","medium","high","urgent"]).optional().
2. Validate PUT body with this schema before proceeding.`,
  },
  {
    file: "app/api/warehouses/route.ts",
    issues: `1. MISSING PAGINATION: GET stock list uses findMany without take/skip — unbounded results DoS. Add pagination: take = min(parseInt(limit??'50'), 100), skip = parseInt(offset??'0').
2. MISSING PAGINATION: GET locations list same issue — add take/skip limits.`,
  },
  {
    file: "app/api/employees/route.ts",
    issues: `1. BUG: DELETE handler doesn't verify employee exists before deleting — Prisma throws P2025 (record not found) which is caught by generic catch and returns misleading 500. Fix by catching Prisma P2025 error code and returning 404 instead.
2. Type assertion: where possible, replace (emp as any) with proper Prisma types; at minimum add a comment.`,
  },
  {
    file: "app/api/inventory/route.ts",
    issues: `1. BUG: try/catch inside transaction loop — failed items add to errors array but transaction continues. This defeats atomicity: partial state can persist. Fix by either: (a) removing individual try/catch inside loop and letting transaction roll back on any failure, OR (b) using separate non-transactional updates per item with proper individual error tracking. Choose option (a) for strict consistency.`,
  },
  {
    file: "app/api/ab-testing/route.ts",
    issues: `1. BUG: exp.metrics[variant].views++ increments on every GET call including repeated refreshes — no per-user/session deduplication. Add session-based deduplication: use a cache key like "abtest:view:{expId}:{variant}:{sessionId}" to track if this session already counted; only increment if not seen.`,
  },
  {
    file: "app/api/audit/route.ts",
    issues: `1. SECURITY: Admin POST accepts ip from request body without validation — allows admin to forge IP addresses in audit records. Fix: ignore client-supplied ip field; always derive IP server-side from req.headers.get("x-forwarded-for") or "unknown".`,
  },
  {
    file: "app/api/cart/route.ts",
    issues: `1. SECURITY/IDOR: GET has no rate limiting — sessionId enumeration possible. Add rate limiting on GET (60 per IP per minute).
2. IDOR: Cart data accessible by anyone who knows the sessionId. While sessionIds are random UUIDs (hard to guess), add a note and consider binding cart to authenticated user session where possible.`,
  },
  {
    file: "app/api/b2b/route.ts",
    issues: `1. IDOR: Authenticated B2B customer can pass any accountId parameter and access competitor data. Add ownership verification: extract the authenticated user's accountId from their JWT token and enforce it matches the requested accountId (unless admin).`,
  },
  {
    file: "app/api/auth/route.ts",
    issues: `1. (prisma as any).passwordReset — no type safety. If the passwordReset model doesn't exist in Prisma schema, this will throw at runtime with no helpful error. Add a try/catch around this specific operation and return a proper error. Also add a comment that the passwordReset model must be added to prisma.schema.`,
  },
  {
    file: "app/api/payments/stripe/route.ts",
    issues: `1. BUG: Stock restoration on payment failure parses items as JSON string without try/catch — if items field is malformed JSON, the catch block will throw another exception masking the original error. Wrap JSON.parse(checkout.items) in try/catch and log a warning if parsing fails (don't crash the error handler).`,
  },
  {
    file: "app/api/payments/paypal/route.ts",
    issues: `1. BUG: referenceId: referenceId ?? 0 — using 0 as default for a foreign key may cause FK constraint violations or false associations with record ID 0. Fix by using referenceId ?? null (or omit the field if null, depending on the schema).`,
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${"═".repeat(70)}`);
  console.log(`GroceryOS — Claude Auto-Fix (${FIXES.length} files)`);
  console.log(`Model: ${MODEL} | Full file visibility`);
  console.log(`${"═".repeat(70)}`);

  let fixed = 0, failed = 0;
  const results = [];

  for (let i = 0; i < FIXES.length; i++) {
    const { file, issues } = FIXES[i];
    console.log(`\n[${i+1}/${FIXES.length}]`);
    try {
      const ok = await fixFile(file, issues);
      if (ok) { fixed++; results.push({ file, status: "✅ FIXED" }); }
      else     { failed++; results.push({ file, status: "⚠️ SKIPPED" }); }
    } catch (e) {
      console.error(`  ❌ ERROR on ${file}: ${e.message}`);
      failed++;
      results.push({ file, status: `❌ ERROR: ${e.message.slice(0,60)}` });
    }
    // Rate limit between API calls
    if (i < FIXES.length - 1) await new Promise(r => setTimeout(r, 1500));
  }

  // ── Final report ─────────────────────────────────────────────────────────
  const reportPath = path.join(ROOT, "review_output", `autofix_report_${Date.now()}.md`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });

  const report = `# GroceryOS Auto-Fix Report
Date: ${new Date().toISOString()}
Model: ${MODEL}

## Results
| File | Status |
|------|--------|
${results.map(r => `| ${r.file} | ${r.status} |`).join("\n")}

## Summary
- ✅ Fixed: ${fixed}
- ❌ Failed/Skipped: ${failed}
- Total: ${FIXES.length}

Note: .bak files created alongside each modified file for rollback.
`;
  fs.writeFileSync(reportPath, report, "utf8");

  console.log(`\n${"═".repeat(70)}`);
  console.log(`AUTO-FIX COMPLETE`);
  console.log(`  ✅ Fixed  : ${fixed}`);
  console.log(`  ❌ Failed : ${failed}`);
  console.log(`  Report   : ${reportPath}`);
  console.log(`${"═".repeat(70)}\n`);
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
