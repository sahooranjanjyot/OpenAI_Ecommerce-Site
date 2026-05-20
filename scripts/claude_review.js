#!/usr/bin/env node
/**
 * GroceryOS — Claude Sequential Code Review
 * Option A (Claude API) + Option B (chunked file export)
 *
 * Strategy:
 *  - Reads FULL file content per file (no char truncation)
 *  - Groups files into batches ≤ 6,000 tokens of code
 *  - Sends each batch to Claude claude-opus-4-5 with goals context
 *  - Accumulates findings across all batches
 *  - Produces final parity report: Done / Pending / Issues / Open
 */

const https   = require("https");
const fs      = require("fs");
const path    = require("path");
const { execSync } = require("child_process");

const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL          = "claude-opus-4-5";
const MAX_BATCH_CHARS = 18000;   // ~4,500 tokens of code per batch (leaves room for prompt)

const ROOT = path.resolve(__dirname, "..");

// ── Collect all files to review ───────────────────────────────────────────────
function collectFiles() {
  const apiRoutes = execSync(
    `find ${ROOT}/frontend/app/api -name "route.ts" | sort`,
    { encoding: "utf8" }
  ).trim().split("\n").filter(Boolean);

  const libFiles = execSync(
    `find ${ROOT}/frontend/lib -name "*.ts" | sort`,
    { encoding: "utf8" }
  ).trim().split("\n").filter(Boolean);

  const infra = [
    path.join(ROOT, "frontend/middleware.ts"),
    path.join(ROOT, "frontend/next.config.js"),
    path.join(ROOT, "kubernetes/deployment.yaml"),
    path.join(ROOT, "kubernetes/network-policy.yaml"),
    path.join(ROOT, "infrastructure/waf-rules.nginx.conf"),
    path.join(ROOT, "frontend/.env.example"),
    path.join(ROOT, "frontend/scripts/env-check.js"),
  ].filter(f => fs.existsSync(f));

  return [...libFiles, ...apiRoutes, ...infra];
}

// ── Build batches ─────────────────────────────────────────────────────────────
function buildBatches(files) {
  const batches = [];
  let current = [];
  let currentLen = 0;

  for (const f of files) {
    let content;
    try { content = fs.readFileSync(f, "utf8"); }
    catch { continue; }

    const label   = f.replace(ROOT, "").replace(/\\/g, "/");
    const snippet = `\n\n${"=".repeat(80)}\nFILE: ${label}\n${"=".repeat(80)}\n${content}`;

    if (currentLen + snippet.length > MAX_BATCH_CHARS && current.length > 0) {
      batches.push(current);
      current    = [];
      currentLen = 0;
    }
    current.push(snippet);
    currentLen += snippet.length;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

// ── Claude API call ───────────────────────────────────────────────────────────
function callClaude(systemPrompt, userMessage) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model:      MODEL,
      max_tokens: 3000,
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
          if (j.error) return reject(new Error(`Claude error: ${j.error.message}`));
          resolve(j.content?.[0]?.text ?? "");
        } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const goalsText = fs.readFileSync(path.join(ROOT, "GroceryOS_Goals.md"), "utf8");
  const addnText  = fs.existsSync(path.join(ROOT, "GroceryOS_Goals_Additions.md"))
    ? fs.readFileSync(path.join(ROOT, "GroceryOS_Goals_Additions.md"), "utf8")
    : "";

  const files   = collectFiles();
  const batches = buildBatches(files);

  console.log(`\n🔍 GroceryOS Claude Sequential Review`);
  console.log(`   Files : ${files.length}`);
  console.log(`   Batches: ${batches.length}  (model: ${MODEL})`);
  console.log(`${"─".repeat(70)}\n`);

  const SYSTEM = `You are a senior security engineer and software auditor.
You are reviewing GroceryOS, a Next.js e-commerce API.

GOALS DOCUMENT (GroceryOS_Goals.md):
${goalsText.slice(0, 8000)}

GOALS ADDITIONS (GroceryOS_Goals_Additions.md):
${addnText.slice(0, 4000)}

For EACH batch of code files I send you:
1. Read the FULL file content carefully — do NOT truncate your analysis.
2. For each file, identify:
   - ✅ DONE: Security controls properly implemented
   - ⚠️ PARTIAL: Implemented but with gaps or caveats
   - ❌ MISSING: Required by goals but not found
   - 🐛 BUG: Code defect that would cause incorrect behavior
   - 🔒 SECURITY: Remaining security concern not yet addressed

3. Track counts: done, partial, missing, bugs, security issues.

Format your response as:
BATCH [N] FINDINGS:
[file]: [finding type] — [brief explanation]
...

BATCH [N] SUMMARY:
✅ Done: X | ⚠️ Partial: Y | ❌ Missing: Z | 🐛 Bugs: A | 🔒 Security: B

Be SPECIFIC — name the exact function/line concern. Do NOT hallucinate fixes that aren't in the code.`;

  const allFindings = [];
  let totalDone = 0, totalPartial = 0, totalMissing = 0, totalBugs = 0, totalSecurity = 0;

  for (let i = 0; i < batches.length; i++) {
    const batchCode = batches[i].join("\n");
    const msg = `Review BATCH ${i + 1} of ${batches.length}:\n${batchCode}`;

    process.stdout.write(`  Batch ${String(i + 1).padStart(2)}/${batches.length} `);

    let response;
    for (let retry = 0; retry < 3; retry++) {
      try {
        response = await callClaude(SYSTEM, msg);
        break;
      } catch (e) {
        if (retry === 2) { response = `ERROR: ${e.message}`; break; }
        await new Promise(r => setTimeout(r, 3000 * (retry + 1)));
        process.stdout.write("↺");
      }
    }

    // Parse summary counts
    const doneM     = response.match(/✅ Done:\s*(\d+)/);
    const partialM  = response.match(/⚠️ Partial:\s*(\d+)/);
    const missingM  = response.match(/❌ Missing:\s*(\d+)/);
    const bugsM     = response.match(/🐛 Bugs:\s*(\d+)/);
    const secM      = response.match(/🔒 Security:\s*(\d+)/);

    const bDone     = parseInt(doneM?.[1]    ?? "0");
    const bPartial  = parseInt(partialM?.[1] ?? "0");
    const bMissing  = parseInt(missingM?.[1] ?? "0");
    const bBugs     = parseInt(bugsM?.[1]    ?? "0");
    const bSec      = parseInt(secM?.[1]     ?? "0");

    totalDone     += bDone;
    totalPartial  += bPartial;
    totalMissing  += bMissing;
    totalBugs     += bBugs;
    totalSecurity += bSec;

    console.log(`✓  ✅${bDone} ⚠️${bPartial} ❌${bMissing} 🐛${bBugs} 🔒${bSec}`);
    allFindings.push(`\n${"═".repeat(70)}\nBATCH ${i + 1}/${batches.length}\n${"═".repeat(70)}\n${response}`);

    // Rate-limit between calls
    if (i < batches.length - 1) await new Promise(r => setTimeout(r, 1500));
  }

  // ── Write full report ───────────────────────────────────────────────────────
  const reportPath = path.join(ROOT, "review_output", `claude_review_${Date.now()}.md`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });

  const total = totalDone + totalPartial + totalMissing + totalBugs + totalSecurity;
  const report = `# GroceryOS Claude Sequential Review
Date: ${new Date().toISOString()}
Model: ${MODEL}
Files reviewed: ${files.length} | Batches: ${batches.length}

## PARITY SUMMARY

| Metric | Count | % of Total |
|--------|-------|-----------|
| ✅ DONE (implemented correctly) | ${totalDone} | ${total ? Math.round(totalDone/total*100) : 0}% |
| ⚠️ PARTIAL (gaps/caveats) | ${totalPartial} | ${total ? Math.round(totalPartial/total*100) : 0}% |
| ❌ MISSING (not implemented) | ${totalMissing} | ${total ? Math.round(totalMissing/total*100) : 0}% |
| 🐛 BUGS (code defects) | ${totalBugs} | ${total ? Math.round(totalBugs/total*100) : 0}% |
| 🔒 SECURITY (remaining concerns) | ${totalSecurity} | ${total ? Math.round(totalSecurity/total*100) : 0}% |
| **TOTAL observations** | **${total}** | 100% |

**Completion rate: ${total ? Math.round((totalDone)/(totalDone+totalMissing)*100) : 0}% of Done vs Missing**

## DETAILED BATCH FINDINGS

${allFindings.join("\n")}
`;

  fs.writeFileSync(reportPath, report, "utf8");

  console.log(`\n${"═".repeat(70)}`);
  console.log(`PARITY REPORT`);
  console.log(`${"═".repeat(70)}`);
  console.log(`  ✅ DONE     : ${totalDone}`);
  console.log(`  ⚠️  PARTIAL  : ${totalPartial}`);
  console.log(`  ❌ MISSING  : ${totalMissing}`);
  console.log(`  🐛 BUGS     : ${totalBugs}`);
  console.log(`  🔒 SECURITY : ${totalSecurity}`);
  console.log(`  ─────────────────`);
  console.log(`  TOTAL       : ${total}`);
  console.log(`  Completion  : ${total ? Math.round((totalDone)/(totalDone+totalMissing)*100) : 0}%`);
  console.log(`\n  Full report: ${reportPath}`);
  console.log(`${"═".repeat(70)}\n`);
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
