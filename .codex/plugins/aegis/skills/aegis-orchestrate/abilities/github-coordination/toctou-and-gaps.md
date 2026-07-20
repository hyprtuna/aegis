# TOCTOU Caveat and Honest Gaps

Full analysis of the non-atomic claim, best-effort detection, the serialize-writers mitigation, and the capability gaps for the GitHub-coordination skill.

---

## The TOCTOU Race

The claim verb in `github-coordination` issues three separate `gh` CLI calls:

1. **Read** — `gh issue view <N> --json body,labels,state` (fetch current block).
2. **Check** — verify `status != "claimed"` AND `state == "open"`.
3. **Write** — `gh issue edit <N> --body "..."` (set `status: claimed`).

These three calls are NOT atomic. The GitHub API provides no compare-and-swap or conditional write. Two agents can both pass step 2 before either completes step 3; the second writer clobbers the first owner silently. ECC's own `assertIssueClaimable()` (ECC `state.js` lines 209-217) is exactly this non-atomic pattern — they named it a guard, not a lock.

### What this means in practice

- The coordination block records **intent**, not exclusion.
- A `coordination:claimed` label means "an agent asserted a claim at some point in time." It does not mean "no other agent can currently write."
- Two valid-looking claims on the same issue are possible when two agents race the read-check-write window.

---

## Best-Effort Race Detection (Post-Write Read-Back)

After completing step 3, immediately re-read the block:

```bash
gh issue view <N> --json body
```

Extract `owner` from the coordination block. If `owner` is not your identity, a later writer clobbered your claim — yield. Mark the issue as not yours, do not proceed with the work, and try a different issue.

This is heuristic, not a guarantee: a third agent could clobber the second writer before the read-back. In practice, with serialized write-subagents (see below), this race window is small enough to be acceptable for advisory coordination.

---

## Real Mitigation: Serialize Your Writers

The only reliable defense against TOCTOU on a non-atomic store is to ensure writes do not overlap in time. Aegis already has this rule — the serialize-writers rule in the `orchestrate` skill's `abilities/subagent-execution.md` fragment (see its Per-Task Execution Loop section).

Apply the same rule to coordination writes: **never dispatch two claim-capable subagents at the same time.** Dispatch one, let it claim, then dispatch the next. The coordination block is a durable, restart-surviving record — its value is that it persists across session restarts, not that it provides mutual exclusion.

---

## Honest Gaps

| Gap | Status |
|---|---|
| GitLab / `glab` mirror | Future ticket — `git-workflow`'s `abilities/gitlab.md` documents `glab`; a coordination overlay could mirror this fragment there. Not built here. |
| Cross-host coordination | Not supported. `gh` reaches GitHub only. |
| Atomic claim (compare-and-swap) | GitHub's issue API has no CAS primitive. True mutual exclusion requires an external atomic store (a database, a Redis lock, etc.) — all of which violate the iron law (no runtime/daemon/MCP). |
| ECC's `validated` / `review-*` / `published` / `synced` states | Intentionally excluded. Those states belong to `code-review` and `git-workflow`, not to this coordination layer. |
| Polling / watch loop | Not supported. Agents check on demand; no daemon watches for dependency closure. |
