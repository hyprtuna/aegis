#!/usr/bin/env bash
# aegis-hook-version: 0.1.5
# post-compact.sh — Aegis plugin PostCompact hook (Claude Code).
#
# WHY THIS EXISTS: after compaction the agent resumes against a
# lossy summary. This hook re-surfaces the anchors that the paired pre-compact
# hook snapshotted (decisions, exact test names, task anchors) so the agent
# re-enters the work with them in view.
#
# Contract (references/claude-code-docs/docs/hooks.md PostCompact): the event JSON
# arrives on stdin with {session_id, transcript_path, cwd, hook_event_name,
# trigger (manual|auto), compact_summary}. PostCompact has NO decision control —
# it cannot alter the compaction result, only react to it — and supports `command`
# dispatch only (D3). This hook re-emits the snapshot as a structured advisory on
# stdout and ALWAYS exits 0; with no snapshot for the transcript it degrades to a
# no-op (durable cross-process state is out of scope for v0.0.7).
set -u

# AEGIS_SKIP guard: global disable / per-hook opt-out → no-op exit 0. Safe under set -e.
if [ "${AEGIS_DISABLE:-}" = "1" ]; then exit 0; fi
case ",${AEGIS_SKIP_HOOKS:-}," in *",post-compact,"*) exit 0 ;; esac

INPUT="$(cat 2>/dev/null || true)"

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

KEY="${SESSION_ID:-}"
if [ -z "$KEY" ] && [ -n "$TRANSCRIPT" ]; then
  KEY="$(printf '%s' "$TRANSCRIPT" | cksum | cut -d' ' -f1)"
fi
[ -n "$KEY" ] || KEY="default"

STORE_DIR="${TMPDIR:-/tmp}/aegis-compaction"
NOTE="${STORE_DIR}/${KEY}.note"

# Nothing captured ⇒ no-op, exit 0.
[ -f "$NOTE" ] || exit 0

SNAPSHOT="$(cat "$NOTE" 2>/dev/null || true)"
[ -n "$SNAPSHOT" ] || exit 0

# Re-emit the captured anchors as a structured advisory. We print to stdout (and
# do not claim a decision field PostCompact does not honor). One-time consume:
# remove the note so a later session does not see stale anchors. Cleanup failure
# is non-fatal.
printf '%s\n' "$SNAPSHOT"
rm -f "$NOTE" 2>/dev/null || true

exit 0
