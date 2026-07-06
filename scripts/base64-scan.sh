#!/usr/bin/env bash
# base64-scan.sh — flag suspiciously long base64-looking blobs.
#
# Long contiguous base64 runs (>=120 chars) can hide encoded payloads. This
# greps the working tree for such runs, skipping vendored/generated dirs.
# Exit 1 if any blob is found, 0 if clean.
#
# Usage: bash scripts/base64-scan.sh        # from repo root
# bash + grep only.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

EXCLUDES=(--exclude-dir=node_modules --exclude-dir=references --exclude-dir=.git --exclude-dir=dist)

# A run of >=120 base64 chars optionally '='-padded. The alphabet includes the
# URL-safe variant (`-` and `_`) as well as standard (`+` `/`), so JWT/web-style
# URL-safe payloads are caught, not just standard base64.
PATTERN='[A-Za-z0-9+/_-]{120,}={0,2}'

hits=0
tmp="$(mktemp)"
trap 'rm -f "${tmp}"' EXIT

if grep -rnIoE "${EXCLUDES[@]}" -- "${PATTERN}" . >> "${tmp}" 2>/dev/null; then
  :
fi

if [[ -s "${tmp}" ]]; then
  # Drop self-matches (this script names the threshold but holds no real blob).
  grep -v '^\./scripts/base64-scan\.sh:' "${tmp}" > "${tmp}.f" || true
  if [[ -s "${tmp}.f" ]]; then
    echo "base64-scan: long base64-like blob(s) found:" >&2
    # Show file:line and a short prefix of the blob, not the whole thing.
    while IFS= read -r line; do
      loc="${line%%:*}"
      rest="${line#*:}"
      ln="${rest%%:*}"
      blob="${rest#*:}"
      echo "${loc}:${ln}: ${blob:0:48}… (${#blob} chars)" >&2
    done < "${tmp}.f"
    hits=1
  fi
  rm -f "${tmp}.f"
fi

if [[ "${hits}" -ne 0 ]]; then
  exit 1
fi
echo "base64-scan: clean"
exit 0
