#!/usr/bin/env bash
# cost-watcher.sh — Aegis background monitor (Claude Code only).
#
# Emits ONE warning line each time ESTIMATED session cost crosses a budget band
# (50%, 75%, 90% of AEGIS_COST_BUDGET_USD).
#
# ── HONEST CONTRACT (see decisions.md DH8) ──
# Monitors get no session JSON on stdin, so this TAILS the session transcript
# JSONL. CRITICAL HONESTY NOTE: the transcript carries token
# usage but NO cost field — Claude computes cost client-side and does not persist
# it here. So this watcher ESTIMATES cost from cumulative token usage × a price
# table. Every line is labelled "≈ est" and is NOT your actual bill. If you set a
# real per-token price for your plan via the env vars below, the estimate tracks
# more closely; otherwise it uses public Opus list pricing as a rough default.
# Degrades to SILENT no-op if the transcript is absent or the format shifts.
#
# Cache reads are ~10x cheaper than fresh input, and they dominate token volume
# in long sessions — pricing them at full input rate would inflate the estimate
# ~9x. So fresh input (input_tokens + cache_creation) is priced at the input
# rate and cache_read at 10% of it.
#
# Tunables (environment):
#   AEGIS_COST_BUDGET_USD       budget the bands are a fraction of (default 10.00)
#   AEGIS_COST_PER_MTOK_INPUT   $/Mtok for fresh input tokens (default 15)
#   AEGIS_COST_PER_MTOK_OUTPUT  $/Mtok for output tokens      (default 75)
set -u

command -v jq >/dev/null 2>&1 || exit 0
command -v awk >/dev/null 2>&1 || exit 0

BUDGET="${AEGIS_COST_BUDGET_USD:-10.00}"
PIN="${AEGIS_COST_PER_MTOK_INPUT:-15}"
POUT="${AEGIS_COST_PER_MTOK_OUTPUT:-75}"

PROJECT="${CLAUDE_PROJECT_DIR:-$PWD}"
SLUG="$(printf '%s' "$PROJECT" | sed 's#/#-#g')"
DIR="$HOME/.claude/projects/$SLUG"
[ -d "$DIR" ] || exit 0
TRANSCRIPT="$(ls -t "$DIR"/*.jsonl 2>/dev/null | head -1)"
[ -n "$TRANSCRIPT" ] || exit 0

# Per-line: "<fresh_input> <cache_read> <output>" token counts, or nothing.
# fresh_input = input_tokens + cache_creation (full price); cache_read billed at 10%.
JQ_TOK='def n(x): (x // 0);
  (.message.usage // .usage) as $u
  | if $u == null then empty
    else "\(n($u.input_tokens) + n($u.cache_creation_input_tokens)) \(n($u.cache_read_input_tokens)) \(n($u.output_tokens))"
    end'

# Running estimate. Seed from existing lines so a mid-session start is accurate,
# then follow new turns. awk holds cumulative totals + last-crossed band as state.
{
  # Seed: existing content (without following).
  jq -rc "$JQ_TOK" "$TRANSCRIPT" 2>/dev/null
  # Follow: new turns only.
  tail -n0 -F "$TRANSCRIPT" 2>/dev/null | while IFS= read -r line; do
    printf '%s' "$line" | jq -rc "$JQ_TOK" 2>/dev/null
  done
} | awk -v budget="$BUDGET" -v pin="$PIN" -v pout="$POUT" '
  BEGIN { freshTok=0; cacheTok=0; outTok=0; band=0 }
  /^[0-9]+ [0-9]+ [0-9]+$/ {
    freshTok += $1; cacheTok += $2; outTok += $3
    cost = (freshTok/1000000.0)*pin + (cacheTok/1000000.0)*(pin*0.1) + (outTok/1000000.0)*pout
    pct = (budget>0) ? (cost*100.0/budget) : 0
    newband = 0
    if (pct >= 90) newband = 90; else if (pct >= 75) newband = 75; else if (pct >= 50) newband = 50
    if (newband > band) {
      band = newband
      printf "⚠ Aegis: session cost ≈ $%.2f est (%d%% of $%.2f budget) — token-derived estimate, not your bill.\n", cost, newband, budget
      fflush()
    }
  }
'
