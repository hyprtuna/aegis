---
name: finishing-branch
description: 'Use when wrapping up a development branch and deciding whether to merge, open a PR, keep it, or discard it.'
visibility: user
platforms: [claude, opencode, codex, cursor, zed]
---

## Status
finishing-branch starting — running test gate then presenting branch completion options

# Finishing a Development Branch

**Announce:** I'm using the finishing-branch skill to complete this branch — verifying tests then presenting the 4-option menu.

You are about to close out a development branch. Before any destructive action, the test suite must pass. This skill enforces that gate.

---

## Step 1: Verification Gate

Run the full test suite. Use the project's detected test command:

```bash
# Detect test command from package.json or project config
# Default: npm test
npm test
```

**If tests fail:** STOP. Do not present any completion options. Report:

```
## Verification Gate FAILED

Tests are failing on this branch. Fix them before finishing.

Run: npm test
Status: BLOCKED
```

**If tests pass:** proceed to Step 2.

---

## Step 2: Branch Identification

Identify the current branch and the base branch:

```bash
git branch --show-current
# Detect base: try 'main' first, then 'master'
git merge-base HEAD main 2>/dev/null && echo "base=main" || \
git merge-base HEAD master 2>/dev/null && echo "base=master" || \
echo "base=unknown"
```

---

## Step 3: Present the 4-Option Menu

Present exactly these four options, in this order:

```
Finish branch "<current-branch>" — choose an action:

1. Open a pull request
   push + gh pr create --fill

2. Merge into <base-branch>
   checkout base, pull, merge, delete feature branch

3. Keep branch as-is
   no changes made

4. Discard branch
   checkout base, delete "<current-branch>"
```

Wait for the user's choice before proceeding.

---

## Step 4: Execute the Chosen Action

### Option 1 — Open a pull request

```bash
git push -u origin <current-branch>
gh pr create --fill
```

The PR description follows the `pr-writeup` template kind. Its index default is `html`, but the working artifact for a `gh pr create` body is prose, so request the **markdown** variant explicitly (honoring the index default rather than flipping it) and fill its structure exactly:

${TEMPLATE:pr-writeup:markdown}

For a standalone stakeholder writeup (a shareable rendered page rather than the PR body), render the `pr-writeup` **html** variant on request — it is on-request only; the markdown description above is the working default.

Report the PR URL and number.

### Option 2 — Merge into base

```bash
git checkout <base-branch>
git pull
git merge <current-branch>
git branch -d <current-branch>
```

Confirm merge success. Report the merge commit SHA.

### Option 3 — Keep as-is

No action. Report branch name and last commit SHA.

### Option 4 — Discard

**Require confirmation** before deleting:

```
About to delete branch "<current-branch>". This cannot be undone.
Confirm? [y/N]
```

If confirmed:

```bash
git checkout <base-branch>
git branch -D <current-branch>
```

Report deletion.

---

## Cleanup Table

| Option | Working tree | Remote | Feature branch |
|---|---|---|---|
| 1 — PR | unchanged | pushed | kept (open PR) |
| 2 — Merge | unchanged | unchanged | deleted local |
| 3 — Keep | unchanged | unchanged | kept |
| 4 — Discard | unchanged | unchanged | deleted local |

---

## CLI Equivalent

```bash
aegis finish
# Or with a specific mode:
aegis finish --mode pr       # skip menu → PR
aegis finish --mode merge    # skip menu → merge
aegis finish --mode keep     # skip menu → keep
aegis finish --mode discard  # skip menu → discard
```

## CHAIN END — return to user

This is the final link in the Aegis SDD chain
(`brainstorm-spec → implementation-planner → orchestrate → finishing-branch`).
After the branch action completes, return control to the user with a one-line
summary of what was merged / kept / discarded. Do not chain forward to another
skill; the workflow has terminated successfully.

## Done
finishing-branch done — branch action complete; status: DONE
