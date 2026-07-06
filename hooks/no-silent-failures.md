---
kind: hook
name: no-silent-failures
description: Advisory PreToolUse judgment that blocks edits introducing swallowed errors or failure-masking fallbacks.
visibility: internal
platforms: [claude]
---

# No Silent Failures

A Claude `prompt`-dispatch judgment hook on `PreToolUse`, scoped to `Edit|Write|MultiEdit`. It encodes the doctrine of the `silent-failure-discipline` skill as a write-time gate.

## Intent

- Flag empty catch blocks, catch-and-default-without-logging, dropped async rejections, and fallback values that make a failure look like success — the Tier 1 and Tier 2 patterns the skill hunts.
- Judge only what the change introduces, not untouched surrounding code.
- Let genuine handling through: labeled fire-and-forget on non-critical paths, capped retries with logging, and errors that surface to the caller or operator.

## Dispatch

| Field | Value |
|---|---|
| Host | Claude Code (`prompt` dispatch) |
| Event | `PreToolUse` |
| Matcher | `Edit|Write|MultiEdit` |

The operative prompt lives in `no-silent-failures.prompt.json`.

## Response contract

`{"ok": true}` allows the write. `{"ok": false, "reason": "..."}` denies it on `PreToolUse`; the reason naming the `file:line` and hidden behavior is returned to Claude as the tool error.
