#!/usr/bin/env bash
# aegis-hook-version: 0.1.1
# cwd-changed.sh — Aegis CwdChanged hook (Claude Code).
#
# WHY THIS EXISTS (AG-0010 D2/D3): when the working directory changes (for example
# Claude runs `cd`), this hook notes which Aegis language overlay is active for the
# new directory so the agent reaches for the matching developer skill. It probes the
# new cwd for the marker files of each overlay in the shared matcher set (TS/Python/
# Rust/Go) and names the overlay it found.
#
# Contract (references/claude-code-docs/docs/hooks.md §CwdChanged): event JSON arrives
# on stdin with the common fields plus old_cwd and new_cwd. CwdChanged does NOT support
# matchers and has NO decision control — it cannot block the directory change. We emit
# advisory context only. We deliberately do NOT return watchPaths (Aegis's overlays are
# advisory, not a managed watch list). Exit 0 always.
set -u

# AEGIS_SKIP guard (AG-0223): global disable / per-hook opt-out → no-op exit 0. Safe under set -e.
if [ "${AEGIS_DISABLE:-}" = "1" ]; then exit 0; fi
case ",${AEGIS_SKIP_HOOKS:-}," in *",cwd-changed,"*) exit 0 ;; esac

INPUT="$(cat 2>/dev/null || true)"

read_field() {
  local key="$1"
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$INPUT" | jq -r --arg k "$key" '.[$k] // ""' 2>/dev/null
  else
    printf '%s' "$INPUT" | grep -o "\"$key\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1 | sed 's/.*:[[:space:]]*"//; s/"$//'
  fi
}

NEW_CWD="$(read_field new_cwd)"
[ -n "$NEW_CWD" ] || NEW_CWD="$(read_field cwd)"
[ -d "$NEW_CWD" ] || exit 0

# Detect the active overlay from marker files / source extensions in the new cwd.
OVERLAY=""
if compgen -G "${NEW_CWD}/*.ts" >/dev/null 2>&1 || compgen -G "${NEW_CWD}/*.tsx" >/dev/null 2>&1 \
   || [ -f "${NEW_CWD}/tsconfig.json" ]; then
  OVERLAY="typescript-developer"
elif compgen -G "${NEW_CWD}/*.py" >/dev/null 2>&1 || [ -f "${NEW_CWD}/pyproject.toml" ]; then
  OVERLAY="python-developer"
elif compgen -G "${NEW_CWD}/*.rs" >/dev/null 2>&1 || [ -f "${NEW_CWD}/Cargo.toml" ]; then
  OVERLAY="rust-developer"
elif compgen -G "${NEW_CWD}/*.go" >/dev/null 2>&1 || [ -f "${NEW_CWD}/go.mod" ]; then
  OVERLAY="go-developer"
fi

# No overlay match — nothing advisory to add.
[ -n "$OVERLAY" ] || exit 0

MSG="Aegis: ${NEW_CWD} looks like a ${OVERLAY} directory. Reach for skills/languages/${OVERLAY}/SKILL.md for language guidance here."

if command -v python3 >/dev/null 2>&1; then
  ESCAPED=$(printf '%s' "$MSG" | python3 -c 'import sys, json; print(json.dumps(sys.stdin.read()))')
else
  ESCAPED="\"$(printf '%s' "$MSG" | sed 's/\\/\\\\/g; s/"/\\"/g')\""
fi

cat <<JSON
{
  "suppressOutput": true,
  "hookSpecificOutput": {
    "hookEventName": "CwdChanged",
    "additionalContext": ${ESCAPED}
  }
}
JSON

exit 0
