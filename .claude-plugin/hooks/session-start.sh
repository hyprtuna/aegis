#!/usr/bin/env bash
# aegis-hook-version: 0.1.3
# Aegis SessionStart bootstrap.
# Emits Claude-compatible JSON announcing Aegis discovery.

set -euo pipefail

# AEGIS_SKIP guard (AG-0223): global disable / per-hook opt-out → no-op exit 0. Safe under set -e.
if [ "${AEGIS_DISABLE:-}" = "1" ]; then exit 0; fi
case ",${AEGIS_SKIP_HOOKS:-}," in *",session-start,"*) exit 0 ;; esac

# Read the bootstrap skill body (using-aegis) if it exists, else emit a brief pointer.
BOOTSTRAP_SKILL="${CLAUDE_PLUGIN_ROOT}/skills/core/using-aegis/SKILL.md"

if [[ -f "${BOOTSTRAP_SKILL}" ]]; then
  # Strip frontmatter; emit body.
  BODY=$(awk 'BEGIN{fm=0} /^---$/{fm++; next} fm<2{next} {print}' "${BOOTSTRAP_SKILL}")
else
  BODY="Aegis is loaded. See skills/ for available capabilities. Iron laws in rules/. Adapter notes in adapters/."
fi

# JSON-escape via python (universally available); fall back to a minimal escape if python is missing.
if command -v python3 >/dev/null 2>&1; then
  ESCAPED=$(python3 -c 'import sys, json; print(json.dumps(sys.stdin.read()))' <<< "${BODY}")
else
  # Minimal escape — newlines and quotes only.
  ESCAPED=$(printf '%s' "${BODY}" | sed 's/\\/\\\\/g; s/"/\\"/g' | awk 'BEGIN{ORS="\\n"} {print}')
  ESCAPED="\"${ESCAPED%\\n}\""
fi

cat <<JSON
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": ${ESCAPED}
  }
}
JSON
