#!/usr/bin/env bash
# unicode-safety-scan.sh — flag dangerous Unicode in shipped content.
#
# One class (from a hardening pass and audit; a later pass relaxed the emoji policy):
#
#   1. INVISIBLE / BIDI controls — zero-width chars and bidirectional overrides
#      (the "Trojan Source" class). These are NEVER legitimate in source or prose
#      and can hide or reorder text from a human reviewer. Scanned across ALL
#      shipped surfaces.
#
# Emoji are NOT flagged. Purposeful emoji (verdict markers, status legends,
# callouts) are allowed in authored guidance. Only zero-width/bidi characters
# (Trojan-Source class) are gated.
#
# `©`, `®`, `™`, typographic dashes/quotes, and arrows are NOT flagged. A line
# carrying `aegis-allow-unicode-sample` is an intentional example and is exempt.
# Exits 1 on a hit, 0 if clean. bash + grep -P (PCRE) only.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

# This scanner needs PCRE (`grep -P`, the \x{...} codepoint classes below) — GNU
# grep only. On BSD/macOS grep, -P is unsupported and would error; without this
# probe the error gets swallowed and the scan would silently report "clean"
# (a false-negative in a security gate). Fail LOUD instead.
if ! printf 'a' | grep -qP 'a' 2>/dev/null; then
  echo "unicode-safety-scan: requires GNU grep with -P (PCRE); not available here." >&2
  echo "  Install GNU grep (e.g. 'ggrep' on macOS via coreutils/grep) and retry." >&2
  exit 2
fi

EXCLUDES=(--exclude-dir=node_modules --exclude-dir=references --exclude-dir=.git --exclude-dir=dist)

# Class 1 — zero-width + bidi controls (all shipped surfaces).
INVISIBLE='[\x{200B}-\x{200F}\x{202A}-\x{202E}\x{2060}-\x{2064}\x{2066}-\x{206F}\x{FEFF}]'
ALL_DIRS=(skills agents commands rules hooks templates statuslines docs manifest adapters .claude-plugin)

tmp="$(mktemp)"
trap 'rm -f "${tmp}"' EXIT

scan() { # <pattern> <dir...>
  local pat="$1"; shift
  local present=()
  local d
  for d in "$@"; do [[ -e "${d}" ]] && present+=("${d}"); done
  [[ ${#present[@]} -gt 0 ]] || return 0
  grep -rnIP "${EXCLUDES[@]}" -- "${pat}" "${present[@]}" 2>/dev/null >> "${tmp}" || true
}

scan "${INVISIBLE}" "${ALL_DIRS[@]}"

if [[ -s "${tmp}" ]]; then
  grep -v 'aegis-allow-unicode-sample' "${tmp}" > "${tmp}.f" || true
  if [[ -s "${tmp}.f" ]]; then
    echo "unicode-safety-scan: dangerous Unicode (zero-width/bidi) found:" >&2
    sort -u "${tmp}.f" >&2
    rm -f "${tmp}.f"
    exit 1
  fi
  rm -f "${tmp}.f"
fi

echo "unicode-safety-scan: clean"
exit 0
