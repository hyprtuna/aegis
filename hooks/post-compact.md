---
kind: hook
name: post-compact
description: Re-surface the captured session anchors after Claude compacts the context window.
visibility: internal
platforms: [claude, opencode, codex]
---

# Post-Compact Restore

After compaction, the agent resumes against a freshly summarized transcript. The anchors that `pre-compact` snapshotted — decisions, exact test names, task anchors — may no longer be verbatim in the summary. This hook fires once compaction completes (Claude `PostCompact`, OpenCode `session.compacting` phase `post`) to re-surface them.

## Intent

- Read back the snapshot the paired `pre-compact` hook wrote for this transcript.
- Re-emit those anchors as a structured advisory so the agent re-enters the work with its decisions and task targets in view.
- Stay out of the way. The hook never blocks and exits 0 when there is nothing to restore.

## Host Implementations

| Host | File | Status |
|---|---|---|
| Claude Code | `.claude-plugin/hooks/post-compact.sh` | v0.0.7 |
| OpenCode | `.opencode/plugins/aegis.js` (session.compacting, phase post) | partial (no-op placeholder) |
| Codex | `.codex/plugins/aegis/hooks/post-compact.sh` (PostCompact, bundled) | v0.2.1 |
| Cursor | N/A (no hook contract) | — |
| Zed | N/A (no hook contract) | — |

## Contract Notes

Claude `PostCompact` input carries `trigger` and `compact_summary` (the generated summary text). The event has no decision control — it cannot alter the compaction result, only react to it. It supports `command` dispatch only (decisions.md D3). This hook exits 0 and degrades to a no-op when no snapshot exists for the transcript. `pre-compact` and `post-compact` are a symmetric pair and ship together (validator-enforced compaction symmetry, D9).
