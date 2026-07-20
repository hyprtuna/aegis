#!/usr/bin/env bash
# aegis-hook-version: 0.2.2
# pre-compact.sh — Aegis plugin PreCompact hook (Claude Code).
#
# WHY THIS EXISTS: compaction rewrites the conversation into a
# lossy summary. Decisions, exact test names, and task anchors can fall out. This
# hook fires before that rewrite to snapshot those anchors so the paired
# post-compact hook can re-surface them.
#
# Contract (references/claude-code-docs/docs/hooks.md PreCompact): the event JSON
# arrives on stdin with {session_id, transcript_path, cwd, hook_event_name,
# trigger (manual|auto), custom_instructions}. The event supports `command`
# dispatch only (D3). Exiting code 2 would BLOCK compaction and (for manual
# /compact) surface stderr to the user — this hook NEVER does that. Durable
# cross-process state is out of scope for v0.0.7, so the capture store is a
# best-effort transcript-scoped note under a temp dir; if anything is missing the
# hook degrades to a no-op and still exits 0.
set -u

# AEGIS_SKIP guard: global disable / per-hook opt-out → no-op exit 0. Safe under set -e.
if [ "${AEGIS_DISABLE:-}" = "1" ]; then exit 0; fi
case ",${AEGIS_SKIP_HOOKS:-}," in *",pre-compact,"*) exit 0 ;; esac

INPUT="$(cat 2>/dev/null || true)"

# Best-effort field extraction. jq if present (an Aegis dependency); otherwise a
# minimal grep fallback so the hook still works on a bare box.
read_field() {
  local key="$1"
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$INPUT" | jq -r --arg k "$key" '.[$k] // ""' 2>/dev/null
  else
    printf '%s' "$INPUT" | grep -o "\"$key\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1 | sed 's/.*:[[:space:]]*"//; s/"$//'
  fi
}

SESSION_ID="$(read_field session_id)"
TRANSCRIPT="$(read_field transcript_path)"
TRIGGER="$(read_field trigger)"
CUSTOM="$(read_field custom_instructions)"

# Key the note by session id (fall back to a hash of the transcript path, then a
# fixed name) so post-compact can find it. No durable store ⇒ best-effort only.
KEY="${SESSION_ID:-}"
if [ -z "$KEY" ] && [ -n "$TRANSCRIPT" ]; then
  KEY="$(printf '%s' "$TRANSCRIPT" | cksum | cut -d' ' -f1)"
fi
[ -n "$KEY" ] || KEY="default"

STORE_DIR="${TMPDIR:-/tmp}/aegis-compaction"
NOTE="${STORE_DIR}/${KEY}.note"

# Snapshot what we can. mkdir/write failures are non-fatal (degrade to no-op).
if mkdir -p "$STORE_DIR" 2>/dev/null; then
  {
    printf 'Aegis pre-compact snapshot (trigger=%s)\n' "${TRIGGER:-unknown}"
    printf 'Captured before compaction — re-surface decisions, exact test names, and task anchors.\n'
    if [ -n "$CUSTOM" ]; then
      printf 'User custom_instructions: %s\n' "$CUSTOM"
    fi
  } > "$NOTE" 2>/dev/null || true
fi

# Never block. PreCompact has no required output; exit 0 cleanly.
exit 0
