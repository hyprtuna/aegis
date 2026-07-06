# Security Scans

Aegis ships five security scanners in `scripts/`. They are plain bash plus
`grep` — no npm dependencies, no Node, no Bun. Run them from the repo root.

Be honest about what they are: **heuristic scanners**, not a secret-management
system. They catch the common, high-confidence mistakes — a key pasted into a
file, an encoded blob, an injection phrase in authored content. They do not
replace a real vault, pre-commit hooks on every developer machine, or rotation
discipline. Treat a clean run as "no obvious problem found", not "proven safe".

## The triplet

### `secret-scan.sh` — committed secrets

Greps the working tree for high-confidence secret patterns:

- PEM private-key headers (`-----BEGIN ... PRIVATE KEY-----`)
- AWS access key ids (`AKIA…`, `ASIA…`)
- GitHub tokens (`ghp_…`, `gho_…`, fine-grained `github_pat_…`)
- Slack tokens (`xox[baprs]-…`)
- OpenAI-style keys (`sk-…`)
- Google API keys (`AIza…`)
- Quoted high-entropy assignments to secret-ish names (`password`,
  `api_key`, `access_token`, and similar)

It skips `node_modules`, `references`, `.git`, and `dist`, and drops matches of
its own pattern literals so the script does not flag itself.

```bash
bash scripts/secret-scan.sh
```

### `base64-scan.sh` — encoded payloads

Flags contiguous base64-alphabet runs of **120 or more characters** (optional
`=` padding). Long encoded blobs can hide payloads. It skips the same vendored
and generated directories and prints `file:line` plus a short prefix and the
blob length rather than the whole blob.

```bash
bash scripts/base64-scan.sh
```

### `prompt-injection-scan.sh` — injection phrasing in authored content

Scans the canonical authored surfaces (`skills/`, `agents/`, `commands/`,
`rules/`) for classic prompt-injection trigger phrases — "ignore previous
instructions", "disregard the above", "reveal your system prompt",
"exfiltrate", and similar. These should never appear as live instructions in
Aegis's own content. The phrase list is curated to avoid matching legitimate
security prose (bare "system prompt" is too broad, so the patterns require the
injection-flavored verbs around it).

```bash
bash scripts/prompt-injection-scan.sh
```

### `unicode-safety-scan.sh` — dangerous Unicode

**Invisible/bidi controls** — zero-width characters and bidirectional overrides
(the "Trojan Source" class, e.g. `U+200B`, `U+202E`, `U+FEFF`) — are scanned
across all shipped surfaces; they are never legitimate and can hide or reorder
text from a human reviewer. This is the sole security gate in this scanner.

**Emoji are not scanned.** Purposeful emoji (verdict markers such as `⚠️`,
status legends, callouts) are allowed in authored guidance. Gratuitous decoration
is still discouraged by taste, but is not gated. `©`/`®`/`™`, dashes, quotes,
and arrows are not flagged. A line marked `aegis-allow-unicode-sample` is exempt.

```bash
bash scripts/unicode-safety-scan.sh
```

### `personal-paths-scan.sh` — hardcoded home paths

Flags hardcoded personal/home paths (`/home/<you>/…`, `/Users/<you>/…`,
`\Users\<you>\…`) in shipped surfaces — they leak the author's username and break
for everyone else. Placeholder paths (`/home/user`, `/home/u`, `/Users/you`, …)
and lines marked `aegis-allow-path-sample` are exempt. `.aegis/` (repo-internal
planning) and `references/` are not scanned. Genericize a real hit to
`/path/to/…` or a placeholder.

```bash
bash scripts/personal-paths-scan.sh
```

## Exit-code contract

Each script follows the same contract:

- **Exit 0** — clean. Prints `<scanner>: clean`.
- **Exit 1** — at least one match. Prints the offending `file:line` entries to
  stderr.

All use `set -euo pipefail`, so an internal failure also aborts non-zero.
This makes them straightforward to chain in CI or a pre-push hook: any non-zero
exit stops the pipeline.

## The PR mandate

Every PR must pass the structural gate **and** all five scans before merge:

```bash
node scripts/validate-structure.mjs
bash scripts/secret-scan.sh
bash scripts/base64-scan.sh
bash scripts/prompt-injection-scan.sh
bash scripts/unicode-safety-scan.sh
bash scripts/personal-paths-scan.sh
```

All must exit 0. `validate-structure.mjs` covers structure and the warn-only
hardening rules (see [`validators.md`](validators.md)); the five scans cover the
security surface. The mandate is also recorded in the root `AGENTS.md` under
"Security & Configuration Tips".

## Scope and limits

- **Heuristics, not proofs.** Pattern matching has false negatives. A secret in
  an unusual format, a short token, or an obfuscated payload can slip through.
- **No history scan.** The scanners read the working tree, not git history. A
  secret already committed and later deleted stays in history; use a dedicated
  history-rewrite tool for that.
- **Authored-content focus for injection.** `prompt-injection-scan.sh` checks
  the canonical surfaces only — it is a guard against shipping injection
  phrasing in Aegis's own prose, not a runtime input filter.
- **Not a substitute for secret management.** Keep real secrets out of the repo
  entirely — in environment variables or a vault — rather than relying on a
  scanner to catch them after the fact.
