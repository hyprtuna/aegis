---
kind: hook
name: no-rationalization
description: Advisory PreToolUse judgment on Bash that blocks commands skipping a verification, narrowing a check, or deferring required work.
visibility: internal
platforms: [claude]
---

# No Rationalization

A Claude `prompt`-dispatch judgment hook on `PreToolUse`, scoped to `Bash`. It encodes the `rationalization-prevention` rule as a command-time gate.

## Intent

- Catch the rationalized shortcut at the moment it is run: forcing a commit/push/merge past a gate, narrowing a verification to dodge a likely failure, marking a test skipped instead of fixing it, or deferring work without a recorded decision.
- `Bash` is the chosen matcher because that is where verification and gate-bypass commands actually execute; the judgment categories may only bind `PreToolUse` (D3), so a real completion-signal event is not available — `Bash` is the closest write-time surface.
- Stay advisory: a focused test run during iteration, read-only inspection, and a documented scoped action all pass.

## Dispatch

| Field | Value |
|---|---|
| Host | Claude Code (`prompt` dispatch) |
| Event | `PreToolUse` |
| Matcher | `Bash` |

The operative prompt lives in `no-rationalization.prompt.json`.

## Response contract

`{"ok": true}` allows the command. `{"ok": false, "reason": "..."}` denies it on `PreToolUse`; the reason names the pattern and the step that should run instead.
