---
kind: hook
name: verification-before-completion
description: Advisory PreToolUse agent gate on Bash that, before a commit, verifies the completion claim is backed by fresh evidence.
visibility: internal
platforms: [claude]
---

# Verification Before Completion

A Claude `agent`-dispatch judgment hook on `PreToolUse`, scoped to `Bash`. Unlike a single-shot prompt hook, this spawns a verifier subagent with tool access (Read, Grep, Glob, and the ability to run the project's checks) so it can inspect the actual change rather than the hook input alone.

## Intent

- Encode the `verification-before-completion` rule and the `verification` skill's iron law — no completion claim without fresh, observable evidence — as a gate that fires when the agent is about to commit.
- The spawned verifier performs a `code-reviewer`-style pass in prose: inspect the pending diff, identify the claim, and confirm tests/build/lint back it, watching for the silent-failure and rationalization patterns.
- Per D4, an `agent` hook spawns an ad-hoc subagent from a prompt — there is no field to name the `code-reviewer` subagent, so the gate references that checklist in prose rather than invoking it.

## Matcher choice

The judgment categories may only bind `PreToolUse` (D3), which has no dedicated completion event. `Bash` is the most appropriate matcher because `git commit`/`push`/`merge`/`tag` — the real completion signals — run through it. The prompt short-circuits to allow on any non-completion command, so the verifier only does work when a completion signal is detected.

## Dispatch

| Field | Value |
|---|---|
| Host | Claude Code (`agent` dispatch) |
| Event | `PreToolUse` |
| Matcher | `Bash` |

The operative prompt lives in `verification-before-completion.agent.json`.

## Response contract

`{"ok": true}` allows the command. `{"ok": false, "reason": "..."}` denies it on `PreToolUse`; the reason names the failed gate and the specific missing evidence or failing check.
