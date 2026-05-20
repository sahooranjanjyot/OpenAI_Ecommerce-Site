#!/usr/bin/env python3
"""
GroceryOS Sequential Claude Code Review
Strategy B + A: Full-file content (12,000 chars/file) sent in sequential batches.
Each batch: 3 files. Claude reviews each against Goals.md + Goals_Additions.md.
Final pass: Claude synthesises all batch findings into a consolidated scorecard.
"""

import os, json, time, glob, sys
from pathlib import Path
import urllib.request, urllib.error

API_KEY   = os.environ.get('ANTHROPIC_API_KEY', '')
MODEL     = "claude-opus-4-5"
MAX_CHARS = 12_000
FILES_PER_BATCH = 3
DELAY_SECS = 2

REPO   = Path("/Users/jyotiranjan/.gemini/antigravity/scratch/OpenAI_Ecommerce-Site")
FRONT  = REPO / "frontend"
OUT    = REPO / "review_output"
OUT.mkdir(exist_ok=True)

def load_goals():
    g1 = (REPO / "GroceryOS_Goals.md").read_text(errors="replace")[:8000]
    try:
        g2 = (REPO / "GroceryOS_Goals_Additions.md").read_text(errors="replace")[:6000]
    except FileNotFoundError:
        g2 = "(GroceryOS_Goals_Additions.md not found)"
    return g1, g2

def collect_files():
    patterns = [
        str(FRONT / "app/api/**/*.ts"),
        str(FRONT / "lib/*.ts"),
        str(FRONT / "middleware.ts"),
        str(FRONT / "__tests__/**/*.ts"),
        str(REPO  / "*.md"),
        str(REPO  / "*.yml"),
        str(REPO  / "*.yaml"),
        str(FRONT / "package.json"),
        str(FRONT / "tsconfig.json"),
    ]
    files = []
    seen  = set()
    for pat in patterns:
        for f in sorted(glob.glob(pat, recursive=True)):
            if (f not in seen
                    and "node_modules" not in f
                    and ".next" not in f
                    and "review_output" not in f):
                seen.add(f)
                files.append(f)
    return files

def call_claude(prompt: str, system: str) -> str:
    payload = json.dumps({
        "model":      MODEL,
        "max_tokens": 3000,
        "system":     system,
        "messages":   [{"role": "user", "content": prompt}],
    }).encode()
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=payload,
        headers={
            "x-api-key":         API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type":      "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read())
        return data["content"][0]["text"]

def make_batch_prompt(file_contents, goals1, goals2, batch_num, total):
    header = f"""=== BATCH {batch_num}/{total} — GroceryOS Code Review ===

## GOALS REFERENCE (excerpts)
### GroceryOS_Goals.md:
{goals1[:4000]}

### GroceryOS_Goals_Additions.md:
{goals2[:3000]}

## TASK
For each file: identify Goals IMPLEMENTED ✅, PARTIAL ⚠️, MISSING ❌, plus security issues (CRITICAL/HIGH/MEDIUM/LOW).
Be concise. Reference Goal IDs where applicable. End with issue counts for this batch.

## FILES
"""
    for path, content in file_contents:
        rel = path.replace(str(REPO) + "/", "")
        header += f"\n### {rel}\n```\n{content}\n```\n"
    header += "\nRespond with file-by-file bullets + batch issue count table.\n"
    return header

def make_synthesis_prompt(all_findings, goals1, goals2):
    combined = "\n\n---\n\n".join(f"BATCH {i+1}:\n{f}" for i, f in enumerate(all_findings))
    return f"""You reviewed ALL {len(all_findings)} batches of GroceryOS. Produce the FINAL CONSOLIDATED REPORT.

## GOALS REFERENCE
{goals1[:5000]}
{goals2[:3000]}

## ALL BATCH FINDINGS:
{combined[:40000]}

## OUTPUT FORMAT:
1. GOAL COMPLETION (vs 564 total):
   - Confirmed complete ✅: N
   - Partial ⚠️: N  
   - Cannot verify ❓: N
   - Not implemented ❌: N

2. ISSUE COUNTS (deduplicated):
   - CRITICAL: N — list top 3
   - HIGH: N — list top 5
   - MEDIUM: N
   - LOW: N

3. PRODUCTION READINESS SCORE: N/100

4. TOP 5 REMAINING BLOCKERS

5. ACKNOWLEDGEMENT of 87 fixes already applied (bcrypt, transactions, CSRF, etc.)

Be precise. Only count ✅ if you saw the implementation in the batch code.
"""

def main():
    print("Collecting files...")
    files  = collect_files()
    print(f"  Found {len(files)} files")
    goals1, goals2 = load_goals()
    batches = [files[i:i+FILES_PER_BATCH] for i in range(0, len(files), FILES_PER_BATCH)]
    print(f"  {len(batches)} batches of {FILES_PER_BATCH}\n")

    all_findings = []

    for bn, batch in enumerate(batches, 1):
        names = [Path(f).name for f in batch]
        print(f"Batch {bn:02d}/{len(batches)}: {names}")
        file_contents = []
        for fp in batch:
            try:
                content = Path(fp).read_text(errors="replace")[:MAX_CHARS]
            except Exception as e:
                content = f"(read error: {e})"
            file_contents.append((fp, content))

        prompt = make_batch_prompt(file_contents, goals1, goals2, bn, len(batches))
        system = ("You are an expert security auditor. Review code carefully. "
                  "Reference specific Goal IDs. Be evidence-based, not speculative.")
        try:
            result = call_claude(prompt, system)
            all_findings.append(result)
            out_file = OUT / f"batch_{bn:02d}.txt"
            out_file.write_text(result)
            print(f"  ✅ Done — {len(result)} chars")
        except Exception as e:
            err = f"ERROR: {e}"
            print(f"  ❌ {err}")
            all_findings.append(err)

        if bn < len(batches):
            time.sleep(DELAY_SECS)

    print(f"\nSynthesising {len(all_findings)} batches...")
    synth = make_synthesis_prompt(all_findings, goals1, goals2)
    system_s = ("You are a principal engineer writing an executive security report. "
                "Be precise, use exact numbers, do not invent issues not found in the batch findings.")
    try:
        final = call_claude(synth, system_s)
        (OUT / "FINAL_REPORT_V2.txt").write_text(final)
        print("\n" + "="*80)
        print(final)
        print("="*80)
    except Exception as e:
        final = f"Synthesis error: {e}"
        print(f"❌ {final}")

    (OUT / "ALL_BATCHES.txt").write_text(
        "\n\n" + "="*60 + "\n\n".join(f"BATCH {i+1}:\n{f}" for i, f in enumerate(all_findings))
    )
    print(f"\nOutput dir: {OUT}")
    return final

if __name__ == "__main__":
    main()
