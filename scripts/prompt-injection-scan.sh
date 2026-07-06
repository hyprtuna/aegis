#!/usr/bin/env bash
# prompt-injection-scan.sh — flag prompt-injection phrasing in canonical prose.
#
# Scans the canonical authored surfaces (skills/ agents/ commands/ rules/) for
# classic prompt-injection trigger phrases. These should never appear as live
# instructions in our own content. Exit 1 if any phrase is found, 0 if clean.
#
# Usage: bash scripts/prompt-injection-scan.sh    # from repo root
# bash + grep only.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

DIRS=(skills agents commands rules)

EXCLUDES=(--exclude-dir=node_modules --exclude-dir=references --exclude-dir=.git --exclude-dir=dist)

# Case-insensitive injection phrases. Curated to avoid matching legitimate
# security/docs prose ("system prompt" alone is too broad, so we require the
# injection-flavored verbs around it).
PATTERNS=(
  'ignore (all )?(the )?previous instructions'
  'ignore (all )?(the )?above instructions'
  'disregard (the )?(above|previous|prior)'
  'forget (all )?(your )?(previous|prior) (instructions|rules)'
  'you are now (a|an|the|in)'
  'override (your|the) (system|prior) (prompt|instructions)'
  'reveal (your|the) (system )?prompt'
  'print (your|the) (system )?prompt'
  'exfiltrate'
  'leak (the|your) (secret|credential|api[_-]?key|token)'
)

# Only scan dirs that exist.
existing=()
for d in "${DIRS[@]}"; do
  [[ -d "${d}" ]] && existing+=("${d}")
done

hits=0
tmp="$(mktemp)"
trap 'rm -f "${tmp}"' EXIT

if [[ ${#existing[@]} -gt 0 ]]; then
  for pat in "${PATTERNS[@]}"; do
    if grep -rnIiE "${EXCLUDES[@]}" -- "${pat}" "${existing[@]}" >> "${tmp}" 2>/dev/null; then
      :
    fi
  done
fi

if [[ -s "${tmp}" ]]; then
  # Allow documented samples: a line carrying the marker `aegis-allow-injection-sample`
  # is an intentional illustration in our own security/docs prose, not a live
  # injection — exempt it so the gate never self-trips on threat documentation.
  grep -v 'aegis-allow-injection-sample' "${tmp}" > "${tmp}.f" || true
  if [[ -s "${tmp}.f" ]]; then
    echo "prompt-injection-scan: injection phrase(s) found:" >&2
    sort -u "${tmp}.f" >&2
    hits=1
  fi
  rm -f "${tmp}.f"
fi

if [[ "${hits}" -ne 0 ]]; then
  exit 1
fi
echo "prompt-injection-scan: clean"
exit 0
