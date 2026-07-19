#!/usr/bin/env bash
# personal-paths-scan.sh — flag hardcoded personal/home paths in shipped content.
#
# A canonical surface that ships to hosts must not bake in a maintainer's machine
# path (e.g. /home/<you>/..., /Users/<you>/...). Such paths leak the author's
# username and break for every other user. This scans the shipped surfaces and
# exits 1 on a hit, 0 if clean. (Added in the same hardening pass as the unicode-safety scan.)
#
# Placeholder paths are allowed: /home/user, /home/u, /Users/you, etc. A line
# carrying the marker `aegis-allow-path-sample` is an intentional example and is
# exempt. `.aegis/` (repo-internal planning) and `references/` are NOT scanned.
#
# Usage: bash scripts/personal-paths-scan.sh    # from repo root
# bash + grep only.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

DIRS=(skills agents commands rules hooks templates statuslines docs manifest adapters .claude-plugin)
EXCLUDES=(--exclude-dir=node_modules --exclude-dir=references --exclude-dir=.git --exclude-dir=dist)

# A real-looking home path: /home/<name>/ or /Users/<name>/ (also Windows \Users\).
PATTERN='(/home/|/Users/|\\Users\\)[A-Za-z0-9._-]+(/|\\)'

# Placeholder names that are clearly examples, not a real machine. Lines whose
# home path uses one of these are exempt.
# Kept to UNAMBIGUOUS placeholders only — tokens that double as plausible real
# usernames (dev, developer, me, name, home, root) were removed
# so a genuine `/home/dev/...` leak is not silently exempted. For an example
# path that legitimately uses one of those, mark the line `aegis-allow-path-sample`.
ALLOW='(/home/|/Users/|\\Users\\)(user|users|u|you|youruser|username|example|examples|foo|bar|baz|someone|path|project|your-?user)(/|\\)'

existing=()
for d in "${DIRS[@]}"; do
  [[ -e "${d}" ]] && existing+=("${d}")
done

tmp="$(mktemp)"
trap 'rm -f "${tmp}" "${tmp}.f"' EXIT

if [[ ${#existing[@]} -gt 0 ]]; then
  grep -rnIE "${EXCLUDES[@]}" -- "${PATTERN}" "${existing[@]}" 2>/dev/null >> "${tmp}" || true
fi

if [[ -s "${tmp}" ]]; then
  # Drop allowlisted placeholders and intentionally-marked sample lines.
  grep -vE "${ALLOW}" "${tmp}" 2>/dev/null | grep -v 'aegis-allow-path-sample' > "${tmp}.f" || true
  if [[ -s "${tmp}.f" ]]; then
    echo "personal-paths-scan: hardcoded personal path(s) found (genericize to /path/to/... or a placeholder):" >&2
    sort -u "${tmp}.f" >&2
    exit 1
  fi
fi

echo "personal-paths-scan: clean"
exit 0
