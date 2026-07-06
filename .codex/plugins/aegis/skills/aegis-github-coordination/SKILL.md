---
name: aegis-github-coordination
description: 'Use when multiple agents must coordinate on shared work via GitHub issues — claim/decompose/unblock a unit of work as a durable issue-backed lock over the gh CLI.'
---

## Status
github-coordination starting — coordinating shared work via GitHub issues over gh

# GitHub Coordination Worker

Durable work-lock coordination via GitHub issues and the `gh` CLI. No daemon, no polling, no runtime.

## When to Use

- Multiple agents or sessions need to divide and track a shared body of work.
- You need a lock that survives agent restarts (GitHub is the store; the lock lives in the issue body).
- You are decomposing an epic into claimable units and want to avoid double-work.

## When NOT to Use

- Single agent working alone — use `github-workflow` directly.
- You require true mutual exclusion — this lock is advisory, not atomic. Serialize your writers instead (see **Not atomic** below).

---

## The Model

GitHub issue = the durable store. The issue body carries a fenced JSON block (`aegis.github.coordination.v1`) between HTML-comment sentinels; the issue label records the current coordination state. `gh` is the only tool. Zero runtime, zero polling, zero daemon.

For the full label table, the exact JSON block schema, and copy-paste `gh` recipes, see `abilities/lock-convention.md`.

---

## Verbs

### Decompose

Read an epic issue's task checklist or dependency list. Record the breakdown in the coordination block (`"lastAction": "decompose"`). Each subtask becomes a separate claimable issue — link them via `"dependsOn"`. Do not create branches here; branches come when a subtask is claimed. Use `gh issue view <epic-N> --json body,title,labels`, `gh issue create`, and `gh issue edit` to record the breakdown.

### Claim

1. `gh issue view <N> --json body,labels,state` — read the current coordination block.
2. Verify `status != "claimed"` AND `state == "open"` (the unclaimed check).
3. `gh issue edit <N> --body "<block with status:claimed, owner, claimedAt>" --remove-label "coordination:available" --add-label "coordination:claimed"` — write the updated block AND swap the label in ONE call so body and label cannot diverge.
4. `gh issue comment <N> --body "audit: claimed by <owner> at <ISO-8601>"`.

Post-write read-back (best-effort race detection): `gh issue view <N> --json body` — if `owner` in the block is not you, you lost the race; yield and try another issue.

Exact `gh` recipes in `abilities/lock-convention.md`.

### Unblock

Sweep issues labelled `coordination:blocked`. For each, read `dependsOn` from the coordination block. Check each dependency: `gh issue view <dep-N> --json state`. If all dependencies are closed, flip the issue to `coordination:available`:

```bash
gh issue edit <N> --remove-label "coordination:blocked" --add-label "coordination:available"
gh issue comment <N> --body "audit: unblocked — all deps closed at <ISO-8601>"
```

### Release

On completion: set block `status: "done"`, swap label to `coordination:done`, append audit comment. On abandonment: revert block `status: "available"`, clear `owner`, swap label back to `coordination:available`.

**Release is mandatory.** An orphaned `coordination:claimed` issue blocks other agents from taking the work. Always release, even on failure.

---

## Not Atomic — Serialize Your Writers

The claim verb issues three separate `gh` calls (read → check → write). Two agents can both pass the check before either writes; the later writer silently clobbers the earlier owner. This is the same non-atomic guard ECC's `assertIssueClaimable()` uses — it is not a mutual-exclusion primitive.

Real mitigation: **one write-subagent at a time** — apply the serialize-writers rule from `skills/core/subagent-execution/SKILL.md` (the sequential-execution rule in its Per-Task Execution Loop section). The coordination block is a durable, restart-surviving record, not a mutex.

Full TOCTOU analysis and the honest gap list in `abilities/toctou-and-gaps.md`.

---

## Honest Gaps

- **GitLab / `glab`:** a mirror via `glab` is a future ticket (cross-ref `skills/core/gitlab-workflow/SKILL.md`); not supported here.
- **Cross-host coordination:** only `gh`-reachable GitHub repos.
- **Advisory only:** the lock does not prevent concurrent writes; it records intent.

---

## Done
github-coordination done — work claimed, completed, and released; coordination block updated; status: DONE
