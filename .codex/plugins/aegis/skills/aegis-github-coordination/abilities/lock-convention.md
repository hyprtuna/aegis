# Lock Convention — `aegis.github.coordination.v1`

Full label scheme, issue-body JSON block schema, and copy-paste `gh` recipes for the GitHub-coordination skill.

---

## Label Scheme (4-state Aegis subset)

| Label | Meaning |
|---|---|
| `coordination:available` | Unclaimed; ready to take |
| `coordination:claimed` | Owned and in progress |
| `coordination:blocked` | Waiting on one or more dependencies |
| `coordination:done` | Work merged or closed; lock released |

ECC's `validated`, `review-*`, `published`, and `synced` labels map onto Aegis's existing `code-review` and `github-workflow` skills and are intentionally excluded here.

Create labels once per repo:
```bash
gh label create "coordination:available" --color "0075ca"
gh label create "coordination:claimed"   --color "e4e669"
gh label create "coordination:blocked"   --color "d93f0b"
gh label create "coordination:done"      --color "0e8a16"
```

---

## Issue-Body JSON Block

Place the block at the end of the issue body between the HTML-comment sentinels. The sentinels make the block machine-locatable for read/replace via `gh issue edit --body` round-trips.

```
<!-- aegis-coordination:begin -->
```json
{
  "schemaVersion": "aegis.github.coordination.v1",
  "status": "available",
  "owner": null,
  "claimedAt": null,
  "branch": null,
  "dependsOn": [],
  "lastAction": "create",
  "lastActionAt": "2026-06-21T00:00:00Z"
}
```
<!-- aegis-coordination:end -->
```

Field reference:
- `status` — one of `available | claimed | blocked | done`.
- `owner` — GitHub login or agent identifier; `null` when unclaimed.
- `claimedAt` — ISO-8601 timestamp of the claim; `null` when unclaimed.
- `branch` — working branch name; `null` until the claimer creates one.
- `dependsOn` — array of GitHub issue numbers this issue waits on.
- `lastAction` — last verb applied (`create | decompose | claim | unblock | release`).
- `lastActionAt` — ISO-8601 timestamp of the last action.

---

## `gh` Recipes

### Read current block
```bash
gh issue view <N> --json body,labels,state
```
Parse the JSON between `<!-- aegis-coordination:begin -->` and `<!-- aegis-coordination:end -->`.

### Claim
```bash
# Step 1: read (see above) — verify status != claimed AND state == open
# Step 2: write updated block + swap label
gh issue edit <N> \
  --body "<full issue body with updated coordination block>" \
  --remove-label "coordination:available" \
  --add-label "coordination:claimed"
# Step 3: append audit comment
gh issue comment <N> --body "audit: claimed by <owner> at <ISO-8601>"
# Step 4: post-write read-back (race detection)
gh issue view <N> --json body   # if owner != you, yield
```

### Unblock
```bash
gh issue edit <N> \
  --remove-label "coordination:blocked" \
  --add-label "coordination:available"
gh issue comment <N> --body "audit: unblocked — all deps closed at <ISO-8601>"
```

### Release (completion)
```bash
gh issue edit <N> \
  --body "<updated block: status:done, lastAction:release>" \
  --remove-label "coordination:claimed" \
  --add-label "coordination:done"
gh issue comment <N> --body "audit: released (done) by <owner> at <ISO-8601>"
```

### Release (abandon / yield)
```bash
gh issue edit <N> \
  --body "<updated block: status:available, owner:null, claimedAt:null>" \
  --remove-label "coordination:claimed" \
  --add-label "coordination:available"
gh issue comment <N> --body "audit: released (abandoned) by <owner> at <ISO-8601>"
```

---

## Audit-Comment Format

Every state transition appends a comment in this exact form — one line, append-only, no edits:

```
audit: <verb> by <owner> at <ISO-8601>
```

Examples:
- `audit: claimed by octocat at 2026-06-21T10:00:00Z`
- `audit: unblocked — all deps closed at 2026-06-21T11:00:00Z`
- `audit: released (done) by octocat at 2026-06-21T14:30:00Z`
- `audit: released (abandoned) by octocat at 2026-06-21T12:00:00Z`

Do not edit prior audit comments. The append-only trail is the coordination history.
