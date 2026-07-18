#!/usr/bin/env bash
# aegis-hook-version: 0.1.2
# file-changed.sh — Aegis FileChanged hook (Claude Code).
#
# WHY THIS EXISTS (AG-0010 D2/D3): when a watched source file changes on disk this
# hook surfaces the lint/format reminder that the matching language overlay declares
# (skills/languages/<lang>-developer). It maps the changed file's extension to the
# shared matcher table (hooks/file-changed.json trigger.paths: **/*.ts, **/*.tsx,
# **/*.py, **/*.rs, **/*.go) — the same glob set the overlay skills' Activation note
# points at — and emits the overlay's reminder as advisory context.
#
# Contract (references/claude-code-docs/docs/hooks.md §FileChanged): event JSON
# arrives on stdin with the common fields plus file_path (absolute) and event
# (change|add|unlink). FileChanged has NO decision control — it cannot block the
# change. We classify by extension and echo a reminder; unknown extensions exit
# silently. Exit 0 always; never block.
set -u

# AEGIS_SKIP guard (AG-0223): global disable / per-hook opt-out → no-op exit 0. Safe under set -e.
if [ "${AEGIS_DISABLE:-}" = "1" ]; then exit 0; fi
case ",${AEGIS_SKIP_HOOKS:-}," in *",file-changed,"*) exit 0 ;; esac

INPUT="$(cat 2>/dev/null || true)"

read_field() {
  local key="$1"
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$INPUT" | jq -r --arg k "$key" '.[$k] // ""' 2>/dev/null
  else
    printf '%s' "$INPUT" | grep -o "\"$key\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1 | sed 's/.*:[[:space:]]*"//; s/"$//'
  fi
}

FILE_PATH="$(read_field file_path)"
CHANGE="$(read_field event)"

# Map extension → (overlay skill, reminder). Globs in trigger.paths are the
# host-agnostic table; here we resolve the file's extension to the same language set.
OVERLAY=""
REMINDER=""
case "$FILE_PATH" in
  *.ts|*.tsx)
    OVERLAY="typescript-developer"
    REMINDER="Run the project's TypeScript lint/format (eslint --fix, prettier, or tsc --noEmit) on the changed file before relying on it." ;;
  *.py)
    OVERLAY="python-developer"
    REMINDER="Run the project's Python lint/format (ruff check / ruff format, or black + flake8) on the changed file before relying on it." ;;
  *.rs)
    OVERLAY="rust-developer"
    REMINDER="Run cargo fmt and cargo clippy on the changed file before relying on it." ;;
  *.go)
    OVERLAY="go-developer"
    REMINDER="Run gofmt -w and go vet on the changed file before relying on it." ;;
  *)
    # Not a language-overlay file — nothing advisory to add. Exit clean.
    exit 0 ;;
esac

MSG="Aegis ${OVERLAY} overlay: ${FILE_PATH} ${CHANGE:-changed}. ${REMINDER} See skills/languages/${OVERLAY}/SKILL.md."

if command -v python3 >/dev/null 2>&1; then
  ESCAPED=$(printf '%s' "$MSG" | python3 -c 'import sys, json; print(json.dumps(sys.stdin.read()))')
else
  ESCAPED="\"$(printf '%s' "$MSG" | sed 's/\\/\\\\/g; s/"/\\"/g')\""
fi

cat <<JSON
{
  "suppressOutput": true,
  "hookSpecificOutput": {
    "hookEventName": "FileChanged",
    "additionalContext": ${ESCAPED}
  }
}
JSON

exit 0
