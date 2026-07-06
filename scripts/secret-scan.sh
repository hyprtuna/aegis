#!/usr/bin/env bash
# secret-scan.sh — flag likely committed secrets in the canonical tree.
#
# Greps the working tree for high-confidence secret patterns (private-key
# headers, AWS access keys, GitHub/Slack/generic provider tokens, and
# quoted high-entropy assignments to secret-ish key names). Skips vendored
# and generated dirs. Exit 1 if any likely secret is found, 0 if clean.
#
# Usage: bash scripts/secret-scan.sh        # from repo root
# Node 20+ not required; bash + grep only.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

EXCLUDES=(--exclude-dir=node_modules --exclude-dir=references --exclude-dir=.git --exclude-dir=dist)

# Curated, high-signal patterns. Each is extended-regex (-E).
PATTERNS=(
  '-----BEGIN ([A-Z ]+ )?PRIVATE KEY-----'           # PEM private keys
  'AKIA[0-9A-Z]{16}'                                  # AWS access key id
  'ASIA[0-9A-Z]{16}'                                  # AWS temp access key id
  'ghp_[0-9A-Za-z]{36}'                               # GitHub personal token
  'gho_[0-9A-Za-z]{36}'                               # GitHub OAuth token
  'github_pat_[0-9A-Za-z_]{60,}'                      # GitHub fine-grained PAT
  'xox[baprs]-[0-9A-Za-z-]{10,}'                      # Slack token
  'sk-[A-Za-z0-9]{32,}'                               # OpenAI-style secret key
  'sk_(live|test)_[0-9A-Za-z]{16,}'                   # Stripe secret key
  'rk_(live|test)_[0-9A-Za-z]{16,}'                   # Stripe restricted key
  'AIza[0-9A-Za-z_-]{35}'                             # Google API key
  '(secret|password|passwd|api[_-]?key|access[_-]?token)["'"'"']?\s*[:=]\s*["'"'"'][A-Za-z0-9/+=._-]{16,}["'"'"']'  # quoted secret assignment
)

hits=0
tmp="$(mktemp)"
trap 'rm -f "${tmp}"' EXIT

for pat in "${PATTERNS[@]}"; do
  # -rn file:line:match; -I skip binary; -i so upper/mixed-case key-names
  # (API_KEY=, Password:) and provider prefixes are caught too. Patterns are
  # static literals, so grep returns 0 (match) / 1 (no match) only — a no-match
  # falls through the `if` without tripping `set -e`.
  if grep -rnIiE "${EXCLUDES[@]}" -- "${pat}" . >> "${tmp}" 2>/dev/null; then
    :
  fi
done

if [[ -s "${tmp}" ]]; then
  # The scanner script itself contains the patterns as string literals; drop self-matches.
  grep -v '^\./scripts/secret-scan\.sh:' "${tmp}" > "${tmp}.f" || true
  if [[ -s "${tmp}.f" ]]; then
    echo "secret-scan: likely secret(s) found:" >&2
    sort -u "${tmp}.f" >&2
    hits=1
  fi
  rm -f "${tmp}.f"
fi

if [[ "${hits}" -ne 0 ]]; then
  exit 1
fi
echo "secret-scan: clean"
exit 0
