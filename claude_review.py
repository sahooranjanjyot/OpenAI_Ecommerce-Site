#!/usr/bin/env python3
"""
GroceryOS — Full Sequential Claude Code Review
Strategy: Option B+A — 12,000 chars/file (full visibility) + 3 files/batch (within token limits)
All 75 API routes + lib/* + infra reviewed sequentially.
Claude reviews the code; we just orchestrate.
"""

import json, urllib.request, os, time, sys

API_KEY  = os.environ.get('ANTHROPIC_API_KEY', '')
FE       = "/Users/jyotiranjan/.gemini/antigravity/scratch/OpenAI_Ecommerce-Site/frontend"
REPO     = "/Users/jyotiranjan/.gemini/antigravity/scratch/OpenAI_Ecommerce-Site"
OUT_DIR  = "/tmp/groceryos_review"
CHARS    = 12000   # full file for ALL routes (max measured: 11,870)
BATCH_SZ = 3       # files per Claude call

os.makedirs(OUT_DIR, exist_ok=True)

# ── Helpers ───────────────────────────────────────────────────────────────────
def read(path, limit=CHARS):
    try:
        content = open(path, encoding="utf-8", errors="ignore").read()
        chars   = len(content)
        return content[:limit], chars
    except:
        return "(file not found)", 0

def claude(prompt, max_tokens=4000, retries=3):
    for attempt in range(retries):
        try:
            data = json.dumps({
                "model":      "claude-opus-4-5",
                "max_tokens": max_tokens,
                "messages":   [{"role": "user", "content": prompt}]
            }).encode()
            req = urllib.request.Request(
                "https://api.anthropic.com/v1/messages", data=data,
                headers={"x-api-key": API_KEY, "anthropic-version": "2023-06-01",
                         "content-type": "application/json"})
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.loads(r.read())["content"][0]["text"]
        except Exception as e:
            if attempt < retries - 1:
                print(f"  ⚠️  Retry {attempt+1}: {e}")
                time.sleep(5)
            else:
                return f"ERROR: {e}"

# ── Goals context (first 2500 chars each) ────────────────────────────────────
goals_main = open(f"{REPO}/GroceryOS_Goals.md",            encoding="utf-8").read()[:2500]
goals_add  = open(f"{REPO}/GroceryOS_Goals_Additions.md",  encoding="utf-8").read()[:2500]

GOALS_CTX = f"""
=== GroceryOS_Goals.md (first 2500 chars) ===
{goals_main}

=== GroceryOS_Goals_Additions.md (first 2500 chars) ===
{goals_add}
"""

# ── All files to review (priority-ordered) ───────────────────────────────────
ALL_FILES = [
    # Core security libs
    (f"{FE}/lib/auth-middleware.ts",          "lib/auth-middleware.ts"),
    (f"{FE}/lib/cache.ts",                    "lib/cache.ts"),
    (f"{FE}/lib/resilience.ts",               "lib/resilience.ts"),
    (f"{FE}/lib/logger.ts",                   "lib/logger.ts"),
    (f"{FE}/lib/prisma.ts",                   "lib/prisma.ts"),
    (f"{FE}/lib/feature-flags.ts",            "lib/feature-flags.ts"),
    (f"{FE}/lib/i18n.ts",                     "lib/i18n.ts"),

    # Auth & identity
    (f"{FE}/app/api/auth/route.ts",           "api/auth/route.ts"),
    (f"{FE}/app/api/auth/admin/route.ts",     "api/auth/admin/route.ts"),
    (f"{FE}/app/api/auth/employee/route.ts",  "api/auth/employee/route.ts"),
    (f"{FE}/app/api/mfa/route.ts",            "api/mfa/route.ts"),
    (f"{FE}/app/api/csrf/route.ts",           "api/csrf/route.ts"),

    # Compliance & audit
    (f"{FE}/app/api/gdpr/route.ts",           "api/gdpr/route.ts"),
    (f"{FE}/app/api/audit/route.ts",          "api/audit/route.ts"),
    (f"{FE}/app/api/health/route.ts",         "api/health/route.ts"),

    # Core commerce
    (f"{FE}/app/api/products/route.ts",       "api/products/route.ts"),
    (f"{FE}/app/api/products/variants/route.ts", "api/products/variants/route.ts"),
    (f"{FE}/app/api/products/import-export/route.ts", "api/products/import-export/route.ts"),
    (f"{FE}/app/api/inventory/route.ts",      "api/inventory/route.ts"),
    (f"{FE}/app/api/search/route.ts",         "api/search/route.ts"),

    # Cart & checkout
    (f"{FE}/app/api/cart/route.ts",           "api/cart/route.ts"),
    (f"{FE}/app/api/cart/abandoned/route.ts", "api/cart/abandoned/route.ts"),
    (f"{FE}/app/api/checkout/route.ts",       "api/checkout/route.ts"),
    (f"{FE}/app/api/coupons/route.ts",        "api/coupons/route.ts"),
    (f"{FE}/app/api/promos/route.ts",         "api/promos/route.ts"),
    (f"{FE}/app/api/flash-sales/route.ts",    "api/flash-sales/route.ts"),
    (f"{FE}/app/api/gift-cards/route.ts",     "api/gift-cards/route.ts"),

    # Payments
    (f"{FE}/app/api/payments/stripe/route.ts",  "api/payments/stripe/route.ts"),
    (f"{FE}/app/api/payments/paypal/route.ts",  "api/payments/paypal/route.ts"),
    (f"{FE}/app/api/payments/klarna/route.ts",  "api/payments/klarna/route.ts"),
    (f"{FE}/app/api/payments/split/route.ts",   "api/payments/split/route.ts"),
    (f"{FE}/app/api/payments/crypto/route.ts",  "api/payments/crypto/route.ts"),

    # Orders & fulfilment
    (f"{FE}/app/api/orders/route.ts",         "api/orders/route.ts"),
    (f"{FE}/app/api/orders/track/route.ts",   "api/orders/track/route.ts"),
    (f"{FE}/app/api/orders/invoice/route.ts", "api/orders/invoice/route.ts"),
    (f"{FE}/app/api/refunds/route.ts",        "api/refunds/route.ts"),
    (f"{FE}/app/api/returns/route.ts",        "api/returns/route.ts"),
    (f"{FE}/app/api/shipping/route.ts",       "api/shipping/route.ts"),
    (f"{FE}/app/api/warehouses/route.ts",     "api/warehouses/route.ts"),

    # Customers
    (f"{FE}/app/api/customers/route.ts",         "api/customers/route.ts"),
    (f"{FE}/app/api/customers/profile/route.ts", "api/customers/profile/route.ts"),
    (f"{FE}/app/api/customers/export/route.ts",  "api/customers/export/route.ts"),
    (f"{FE}/app/api/loyalty/route.ts",           "api/loyalty/route.ts"),
    (f"{FE}/app/api/wishlist/route.ts",          "api/wishlist/route.ts"),
    (f"{FE}/app/api/subscriptions/route.ts",     "api/subscriptions/route.ts"),
    (f"{FE}/app/api/reviews/route.ts",           "api/reviews/route.ts"),
    (f"{FE}/app/api/newsletter/route.ts",        "api/newsletter/route.ts"),

    # Business & analytics
    (f"{FE}/app/api/affiliates/route.ts",         "api/affiliates/route.ts"),
    (f"{FE}/app/api/b2b/route.ts",               "api/b2b/route.ts"),
    (f"{FE}/app/api/pricing/route.ts",           "api/pricing/route.ts"),
    (f"{FE}/app/api/bundles/route.ts",           "api/bundles/route.ts"),
    (f"{FE}/app/api/layaway/route.ts",           "api/layaway/route.ts"),
    (f"{FE}/app/api/reports/sales/route.ts",     "api/reports/sales/route.ts"),
    (f"{FE}/app/api/reports/customers/route.ts", "api/reports/customers/route.ts"),
    (f"{FE}/app/api/reports/inventory/route.ts", "api/reports/inventory/route.ts"),
    (f"{FE}/app/api/analytics/route.ts",         "api/analytics/route.ts"),
    (f"{FE}/app/api/insights/route.ts",          "api/insights/route.ts"),
    (f"{FE}/app/api/search-analytics/route.ts",  "api/search-analytics/route.ts"),
    (f"{FE}/app/api/experiments/route.ts",       "api/experiments/route.ts"),

    # Channels & integrations
    (f"{FE}/app/api/email/route.ts",              "api/email/route.ts"),
    (f"{FE}/app/api/sms/route.ts",               "api/sms/route.ts"),
    (f"{FE}/app/api/push/route.ts",              "api/push/route.ts"),
    (f"{FE}/app/api/voice/route.ts",             "api/voice/route.ts"),
    (f"{FE}/app/api/webhooks/route.ts",          "api/webhooks/route.ts"),
    (f"{FE}/app/api/notifications/backInStock/route.ts", "api/notifications/backInStock/route.ts"),
    (f"{FE}/app/api/alerts/stock/route.ts",      "api/alerts/stock/route.ts"),

    # Support & content
    (f"{FE}/app/api/support/route.ts",           "api/support/route.ts"),
    (f"{FE}/app/api/call-centre/route.ts",       "api/call-centre/route.ts"),
    (f"{FE}/app/api/chatbot/route.ts",           "api/chatbot/route.ts"),
    (f"{FE}/app/api/blog/route.ts",              "api/blog/route.ts"),
    (f"{FE}/app/api/moderation/route.ts",        "api/moderation/route.ts"),
    (f"{FE}/app/api/qa/route.ts",               "api/qa/route.ts"),

    # Misc APIs
    (f"{FE}/app/api/graphql/route.ts",           "api/graphql/route.ts"),
    (f"{FE}/app/api/ml/route.ts",               "api/ml/route.ts"),
    (f"{FE}/app/api/currency/route.ts",         "api/currency/route.ts"),
    (f"{FE}/app/api/barcode/route.ts",          "api/barcode/route.ts"),
    (f"{FE}/app/api/digital/route.ts",          "api/digital/route.ts"),
    (f"{FE}/app/api/flags/route.ts",            "api/flags/route.ts"),
    (f"{FE}/app/api/suppliers/route.ts",        "api/suppliers/route.ts"),
    (f"{FE}/app/api/employees/route.ts",        "api/employees/route.ts"),
    (f"{FE}/app/api/errors/route.ts",           "api/errors/route.ts"),
    (f"{FE}/app/api/export/route.ts",           "api/export/route.ts"),
    (f"{FE}/app/api/recommendations/route.ts",  "api/recommendations/route.ts"),

    # Infrastructure
    (f"{FE}/prisma/schema.prisma",              "prisma/schema.prisma"),
    (f"{REPO}/.github/workflows/ci-cd.yml",    "ci-cd.yml"),
    (f"{REPO}/docker/nginx/nginx.conf",        "nginx.conf"),
    (f"{REPO}/docker-compose.yml",             "docker-compose.yml"),
    (f"{REPO}/k8s/deployment.yaml",            "k8s/deployment.yaml"),
    (f"{REPO}/k8s/backup-cronjob.yaml",        "k8s/backup-cronjob.yaml"),
]

# ── Build batches of BATCH_SZ ─────────────────────────────────────────────────
batches = []
for i in range(0, len(ALL_FILES), BATCH_SZ):
    batches.append(ALL_FILES[i:i+BATCH_SZ])

total_batches = len(batches)
print(f"📦 Total files  : {len(ALL_FILES)}")
print(f"📦 Total batches: {total_batches}  ({BATCH_SZ} files each @ {CHARS} chars)")
print(f"📦 File limit   : {CHARS} chars = FULL FILE for all routes")
print()

# ── Run all batches ───────────────────────────────────────────────────────────
all_findings = []
cumulative_c = cumulative_h = cumulative_m = cumulative_l = 0
cumulative_confirmed = 0

prev_summary = "No previous batches yet."

for batch_num, batch in enumerate(batches, 1):
    # Build file payload
    file_sections = []
    for path, label in batch:
        content, chars = read(path)
        status = "COMPLETE" if chars <= CHARS else f"TRUNCATED at {CHARS}"
        file_sections.append(f"\n### {label}  [{chars} chars — {status}]\n```\n{content}\n```")

    payload = "\n".join(file_sections)
    file_labels = [label for _, label in batch]

    prompt = f"""You are a senior security engineer reviewing the GroceryOS Next.js e-commerce platform.
All files below are provided at 12,000 chars — this is FULL CONTENT for every route reviewed.
Do NOT assume truncation unless you literally see code cut mid-statement.

GOALS CONTEXT (what should be implemented):
{GOALS_CTX[:1500]}

PREVIOUS BATCHES SUMMARY:
{prev_summary}

BATCH {batch_num}/{total_batches} — Files: {', '.join(file_labels)}
{payload}

Review every line of every file above.
For EACH issue, cite exact function name and describe the problem.

Report:
## CONFIRMED COMPLETE
- List goal IDs or features confirmed working with code evidence

## ISSUES FOUND
Format each as: [SEVERITY] `file` `function/line` — Problem — Fix
Severity: CRITICAL (prod blocker), HIGH (security risk), MEDIUM (quality), LOW (advisory)

## UNCERTAIN
- Goals you cannot verify (missing code, not in scope)

## BATCH {batch_num} SCORECARD
| CRITICAL | HIGH | MEDIUM | LOW | Confirmed goals |
|----------|------|--------|-----|----------------|
| X | X | X | X | X |

Keep response focused and concise."""

    print(f"▶ Batch {batch_num:02d}/{total_batches}  [{', '.join(file_labels)}]...")
    result = claude(prompt, max_tokens=3000)
    
    # Save batch result
    out_path = f"{OUT_DIR}/batch_{batch_num:02d}.txt"
    open(out_path, "w", encoding="utf-8").write(result)
    all_findings.append(result)

    # Extract scorecard numbers from result
    import re
    scorecard_match = re.search(r'\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)', result)
    if scorecard_match:
        c, h, m, l, conf = [int(x) for x in scorecard_match.groups()]
        cumulative_c += c; cumulative_h += h; cumulative_m += m; cumulative_l += l
        cumulative_confirmed += conf
        print(f"   ✅  C={c} H={h} M={m} L={l} | Confirmed={conf} | Running: C={cumulative_c} H={cumulative_h} M={cumulative_m} L={cumulative_l}")
    else:
        print(f"   ✅  Done (no scorecard matched)")

    # Rolling summary for next batch context (last 300 chars)
    prev_summary = f"Batches 1-{batch_num} running totals: CRITICAL={cumulative_c} HIGH={cumulative_h} MEDIUM={cumulative_m} LOW={cumulative_l} Confirmed={cumulative_confirmed}\nLast batch findings (last 300 chars): {result[-300:]}"

    time.sleep(1)  # brief pause between calls

# ── GRAND FINAL REPORT ────────────────────────────────────────────────────────
print()
print("▶ Generating GRAND CONSOLIDATED REPORT...")

# Collect key findings from all batches (last 400 chars each, first 5 + last 5)
key_extracts = []
for i, finding in enumerate(all_findings, 1):
    key_extracts.append(f"--- Batch {i} ---\n{finding[-400:]}")

consolidated_input = "\n".join(key_extracts[:8]) + "\n...\n" + "\n".join(key_extracts[-5:])

final_prompt = f"""You have just completed a full sequential review of the GroceryOS codebase (75+ API routes, all files fully visible at 12,000 chars/file).

Running totals across ALL {total_batches} batches:
  CRITICAL : {cumulative_c}
  HIGH     : {cumulative_h}
  MEDIUM   : {cumulative_m}
  LOW      : {cumulative_l}
  TOTAL    : {cumulative_c + cumulative_h + cumulative_m + cumulative_l}
  Confirmed goals: {cumulative_confirmed}

Key batch findings (extracts):
{consolidated_input[:4000]}

Goals files reviewed against:
- GroceryOS_Goals.md: 327 items
- GroceryOS_Goals_Additions.md: 237 items
- TOTAL: 564 items

Produce the GRAND CONSOLIDATED REPORT:

## FINAL ISSUE COUNTS (ALL BATCHES)
| 🔴 CRITICAL | 🟠 HIGH | 🟡 MEDIUM | 🟢 LOW | TOTAL |
|-------------|---------|-----------|--------|-------|
| {cumulative_c} | {cumulative_h} | {cumulative_m} | {cumulative_l} | {cumulative_c+cumulative_h+cumulative_m+cumulative_l} |

## GOALS STATUS vs 564 TOTAL
| Status | Count | % |
|--------|-------|---|
| ✅ Confirmed complete & correct | X | X% |
| ⚠️ Has code-level issues | X | X% |
| ❓ Cannot verify (not in scope) | X | X% |
| ❌ Not implemented | X | X% |

## TOP 10 GENUINE CRITICAL/HIGH ISSUES
(ranked by business/security impact, with exact file:function evidence)

## CONFIRMED FIXES VERIFIED IN CODE
(list which of the previously applied fixes Claude can confirm in the full code)

## COMPLIANCE SCORES
| Standard | Score | Key Rationale |

## PRODUCTION READINESS: X/100
(evidence-based weighted score)

## SPRINT PLAN
(what to fix first, in priority order)"""

final_report = claude(final_prompt, max_tokens=5000)
open(f"{OUT_DIR}/GRAND_FINAL_REPORT.txt", "w", encoding="utf-8").write(final_report)

print()
print("=" * 70)
print("GRAND CONSOLIDATED REPORT")
print("=" * 70)
print(final_report)
print()
print(f"All batch files saved to: {OUT_DIR}/")
print(f"Grand report: {OUT_DIR}/GRAND_FINAL_REPORT.txt")
