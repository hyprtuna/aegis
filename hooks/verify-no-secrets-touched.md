---
kind: hook
name: verify-no-secrets-touched
description: Advisory PreToolUse judgment that blocks edits writing secret material into tracked files.
visibility: internal
platforms: [claude]
---

# Verify No Secrets Touched

A Claude `prompt`-dispatch judgment hook on `PreToolUse`, scoped to the file-writing tools `Edit|Write|MultiEdit`. Before such a call runs, a fast model reads the hook input and decides whether the content being written introduces hardcoded secret material.

## Intent

- Catch API keys, tokens, private-key blocks, credential pairs, and real values written into committed dotenv files at write time, before they land in a tracked file.
- Stay advisory and narrow: placeholders, environment reads, and obvious dummy fixtures pass.
- Reinforce the `verification-before-completion` rule and the repo secret scans (`scripts/secret-scan.sh`) at the point of edit rather than after the fact.

## Dispatch

| Field | Value |
|---|---|
| Host | Claude Code (`prompt` dispatch) |
| Event | `PreToolUse` |
| Matcher | `Edit|Write|MultiEdit` |

The operative prompt lives in `verify-no-secrets-touched.prompt.json`; this doc records intent for humans (D5).

## Response contract

The model returns strict JSON. `{"ok": true}` allows the write. `{"ok": false, "reason": "..."}` denies it on `PreToolUse`, and the reason is returned to Claude as the tool error.
