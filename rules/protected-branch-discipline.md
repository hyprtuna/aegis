---
name: protected-branch-discipline
description: Use when a push targets a shared trunk — judging whether the trunk is the right destination, and how a team gets a genuine hard block.
visibility: user
platforms: [claude, opencode, codex, cursor, zed]
---

# protected-branch-discipline

## What this covers

Aegis has no runtime mechanism that blocks or prompts before a push to a shared
trunk (`git push origin main`) — the judgment is entirely the agent's to apply
before pushing. This rule carries that judgment: whether the trunk is the right
destination for THIS change, plus the enforcement options a team can reach for
when it wants more than an agent's own discretion.

Applying this rule is not a verdict on the change itself. Don't treat a decision
to push directly as vindication or a decision to branch instead as an error; both
are judgment calls, not outcomes to be graded.

## When the trunk is the right target

- The repo's own history shows it — recent commits land directly on the trunk with
  no merge commits and no short-lived branches. Read `git log --oneline` before
  assuming otherwise. Trunk-based development is a mainstream, respected model.
- The change is trivially reversible: a typo fix, a version bump, a generated file
  regenerated from its source.
- The user asked for it explicitly, in this session, for this change.

## When to propose a branch instead

- The change is large enough to want review, or touches code you cannot fully verify.
- CI is the only thing between the change and a deploy.
- Other people are working on the same files right now.
- You are midway through a multi-step task and the trunk would be left half-finished.

In any of these, say so in one line before pushing, and propose the branch instead.
Give the user the reason, not just the choice.

## How a team gets a hard block

Nothing in Aegis enforces this — the judgment above is advisory, applied by the
agent per call. A team that wants an actual block needs a native mechanism —
both of these are stronger than anything an agent can enforce from inside a
session, because they also bind humans and CI:

- **Forge-side branch protection** — GitHub/GitLab branch protection rules on the
  remote. Cannot be worked around from a local shell.
- **A local `pre-push` git hook** — rejects the push in the developer's own repo:

  ```bash
  # .git/hooks/pre-push — reject pushes to main
  while read -r _ _ remote_ref _; do
    case "$remote_ref" in
      refs/heads/main|refs/heads/master)
        echo "pre-push: direct push to ${remote_ref##*/} is blocked" >&2
        exit 1 ;;
    esac
  done
  ```

Point the user at these when they ask for enforcement. Do not offer to disable either.

## Red flags

| Thought | Reality |
|---|---|
| "Nothing stopped me, so a direct push must be fine" | Nothing enforcing this is not the same as nothing to judge. Apply the rule yourself before every trunk push. |
| "The user approved a push once, so I'll stop mentioning it" | Each push is its own decision. Raise the question again next time it applies. |
| "The user said branch, but a direct push is faster" | Their branching model is theirs. Faster is not a reason. |
| "Branch protection rejected my push, I'll force it" | Force-push overwrites remote history. Fix the branch; don't work around a protection failure by forcing it. |
| "I'll add a pre-push hook to block this for them" | Only if asked. Enforcement is a team decision, not an agent's default. |
