#!/usr/bin/env bash
# aegis-hook-version: 0.3.10
# instructions-loaded.sh — Aegis InstructionsLoaded hook (Claude Code).
#
# WHY THIS EXISTS (AG-0010 D1/D3): InstructionsLoaded fires once per CLAUDE.md or
# .claude/rules/*.md file as it enters context — at session start (load_reason
# session_start) and again on lazy loads (nested_traversal, path_glob_match,
# include, compact). The aegis-doctor skill consumes this to report how many rule
# files actually loaded and to flag silent drops: a path_glob_match load whose
# `globs` are present but where no glob matched the trigger file is a rule that
# declared activation conditions yet contributed nothing.
#
# Contract (references/claude-code-docs/docs/hooks.md §InstructionsLoaded): event
# JSON arrives on stdin with the common fields plus file_path, memory_type,
# load_reason, and (for path_glob_match) globs / trigger_file_path / parent_file_path.
# The event has NO decision control and the exit code is IGNORED — it is for
# observability only. We append one line per load to a session-scoped tally and
# echo an advisory additionalContext line. Exit 0 always; never block.
set -u

# AEGIS_SKIP guard (AG-0223): global disable / per-hook opt-out → no-op exit 0. Safe under set -e.
if [ "${AEGIS_DISABLE:-}" = "1" ]; then exit 0; fi
case ",${AEGIS_SKIP_HOOKS:-}," in *",instructions-loaded,"*) exit 0 ;; esac

INPUT="$(cat 2>/dev/null || true)"

HAVE_JQ=""
command -v jq >/dev/null 2>&1 && HAVE_JQ="yes"

read_field() {
  local key="$1"
  if [ -n "$HAVE_JQ" ]; then
    printf '%s' "$INPUT" | jq -r --arg k "$key" '.[$k] // ""' 2>/dev/null
  else
    # Fallback matches STRING-valued fields only — it cannot read the array-valued
    # `globs` field. The silent-drop classification below accounts for that so the
    # array field never falsely reads as empty (= dropped).
    printf '%s' "$INPUT" | grep -o "\"$key\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1 | sed 's/.*:[[:space:]]*"//; s/"$//'
  fi
}

SESSION_ID="$(read_field session_id)"
FILE_PATH="$(read_field file_path)"
MEMORY_TYPE="$(read_field memory_type)"
LOAD_REASON="$(read_field load_reason)"

# `globs` is an ARRAY field. With jq we can read its length directly; the string
# fallback cannot, so we sniff for a non-empty `"globs": [ ... ]` array form in the
# raw input instead. Either way GLOBS_PRESENT="yes" means a glob list was recorded.
GLOBS_PRESENT=""
if [ -n "$HAVE_JQ" ]; then
  GLOBS_LEN="$(printf '%s' "$INPUT" | jq -r '(.globs // []) | length' 2>/dev/null)"
  [ -n "$GLOBS_LEN" ] && [ "$GLOBS_LEN" != "0" ] && GLOBS_PRESENT="yes"
else
  # Non-empty array: "globs" : [ <at least one non-whitespace char> ]
  if printf '%s' "$INPUT" | grep -Eq '"globs"[[:space:]]*:[[:space:]]*\[[[:space:]]*[^][:space:]]'; then
    GLOBS_PRESENT="yes"
  fi
fi

# A path_glob_match load that arrives with NO recorded globs is a silent drop: the
# rule declared a paths: condition but Claude recorded no matching glob. Only claim
# a drop when we could actually determine glob presence — with jq always, and
# without jq only when the raw-input array sniff is conclusive. Gating on jq (or the
# explicit array sniff) prevents the array-valued field from falsely reading as a
# drop when no JSON parser is available.
DROP=""
if [ "$LOAD_REASON" = "path_glob_match" ] && [ -z "$GLOBS_PRESENT" ]; then
  if [ -n "$HAVE_JQ" ]; then
    DROP="yes"
  else
    # No jq: only classify a drop when the input plainly carries an EMPTY globs
    # array (`"globs": []`). An absent field or unparseable shape is left
    # unclassified rather than falsely flagged.
    if printf '%s' "$INPUT" | grep -Eq '"globs"[[:space:]]*:[[:space:]]*\[[[:space:]]*\]'; then
      DROP="yes"
    fi
  fi
fi

# Best-effort session-scoped tally for aegis-doctor. mkdir/write failures degrade
# to no-op — the hook still exits 0.
KEY="${SESSION_ID:-default}"
STORE_DIR="${TMPDIR:-/tmp}/aegis-doctor"
TALLY="${STORE_DIR}/${KEY}.instructions"
# Cap the per-session tally so it cannot grow unbounded over a long session. Keep
# only the most-recent TALLY_CAP lines; the count summary below is approximate once
# the cap is hit, which is fine for an advisory observability tally.
TALLY_CAP=500
if mkdir -p "$STORE_DIR" 2>/dev/null; then
  printf '%s\t%s\t%s\t%s\n' "${LOAD_REASON:-unknown}" "${MEMORY_TYPE:-unknown}" "${DROP:-no}" "${FILE_PATH:-unknown}" \
    >> "$TALLY" 2>/dev/null || true
  # Prune to the last TALLY_CAP lines via a temp file + atomic rename. Any failure
  # leaves the (slightly larger) tally intact and the hook still exits 0.
  if [ -f "$TALLY" ]; then
    LINES="$(wc -l < "$TALLY" 2>/dev/null | tr -d ' ')"
    [ -n "$LINES" ] || LINES=0
    if [ "$LINES" -gt "$TALLY_CAP" ] 2>/dev/null; then
      if tail -n "$TALLY_CAP" "$TALLY" > "${TALLY}.tmp" 2>/dev/null; then
        mv -f "${TALLY}.tmp" "$TALLY" 2>/dev/null || rm -f "${TALLY}.tmp" 2>/dev/null || true
      fi
    fi
  fi
fi

# Opportunistically prune stale session tally files (older than ~6 hours) so the
# store dir does not accumulate one file per past session forever. Best-effort,
# quoted, never fatal.
find "$STORE_DIR" -maxdepth 1 -type f -name '*.instructions' -mmin +360 -delete 2>/dev/null || true

LOADED_COUNT=0
DROP_COUNT=0
if [ -f "$TALLY" ]; then
  LOADED_COUNT="$(wc -l < "$TALLY" 2>/dev/null | tr -d ' ')"
  DROP_COUNT="$(awk -F'\t' '$3=="yes"{c++} END{print c+0}' "$TALLY" 2>/dev/null)"
fi
[ -n "$LOADED_COUNT" ] || LOADED_COUNT=0
[ -n "$DROP_COUNT" ] || DROP_COUNT=0

MSG="Aegis instructions tally: ${LOADED_COUNT} rule file(s) loaded this session, ${DROP_COUNT} with a paths: condition but no recorded glob match."
if [ -n "$DROP" ]; then
  MSG="${MSG} This load (${FILE_PATH:-unknown}) declared paths: but matched no glob — run aegis-doctor if a rule seems missing."
fi

if command -v python3 >/dev/null 2>&1; then
  ESCAPED=$(printf '%s' "$MSG" | python3 -c 'import sys, json; print(json.dumps(sys.stdin.read()))')
else
  ESCAPED="\"$(printf '%s' "$MSG" | sed 's/\\/\\\\/g; s/"/\\"/g')\""
fi

cat <<JSON
{
  "suppressOutput": true,
  "hookSpecificOutput": {
    "hookEventName": "InstructionsLoaded",
    "additionalContext": ${ESCAPED}
  }
}
JSON

exit 0
