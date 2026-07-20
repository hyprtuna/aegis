---
kind: hook
name: pre-compact
description: Capture session anchors before Claude compacts the context window.
visibility: internal
platforms: [claude, opencode]
---

# Pre-Compact Capture

Compaction rewrites the conversation into a shorter summary. The summary is lossy: decisions made mid-session, the exact names of tests that must pass, and the task anchors the agent is working toward can all fall out. This hook fires before that rewrite (Claude `PreCompact`, OpenCode `session.compacting` phase `pre`) to capture those anchors first.

## Intent

- Snapshot the load-bearing facts the agent should not lose: agreed decisions, exact test or file names, the current task anchor, and any open TODO it is mid-stream on.
- Write that snapshot to a transcript-scoped note so the paired `post-compact` hook can re-surface it.
- Stay out of the way. The hook never blocks compaction and exits 0 even when there is nothing to capture.

## Host Implementations

| Host | File | Status |
|---|---|---|
| Claude Code | `.claude-plugin/hooks/pre-compact.sh` | supported |
| OpenCode | `.opencode/plugins/aegis.js` (session.compacting, phase pre) | partial (no-op placeholder) |
| Codex | — | gap — `plugin_hooks` removed (codex-cli 0.144.6); no plugin-shipped hook can fire |
| Cursor | N/A (no hook contract) | — |
| Zed | N/A (no hook contract) | — |

## Contract Notes

Claude `PreCompact` input carries `trigger` (`manual` for `/compact`, `auto` for context-window overflow) and `custom_instructions`. The event supports `command` dispatch only (decisions.md D3). Exiting non-zero (code 2) would block compaction — this hook never does that; it exits 0 and degrades to a no-op when no capture store is available, since durable cross-process state remains out of scope.
