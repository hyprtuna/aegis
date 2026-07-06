---
kind: skill
name: using-git-worktrees
description: Use when creating isolated git worktrees for parallel feature work — gitignore-safe directory selection.
visibility: user
platforms: [claude, opencode, codex, cursor, zed]
---

# Using Git Worktrees

Worktrees let you run multiple branches concurrently from one clone — no stashing,
no context loss. Use them before any long-running feature, plan execution, or
parallel debug run.

## When to Use

- Starting work on a plan while your main checkout has uncommitted edits.
- Running two agents on two branches at the same time.
- Testing a risky refactor without touching your working tree.

**Don't use** for one-line fixes on the current branch — overhead isn't worth it.

The create/setup/verify/cleanup command blocks, the common-mistakes list, the worktree-aware
project-root resolution, and the subagent `isolation: worktree` guidance live in
`abilities/lifecycle.md`. This body carries directory selection, the safety check, and the forks.

## Directory Selection — `.worktrees/<slug>` is canonical

`.worktrees/<slug>` is the **canonical Aegis worktree directory**. ANV-0155
established this in code (the `aegis worktree create` command writes here by
default); ANV-0139 documents it here. Rationale:

- Top-level and hidden, so it stays out of editor file pickers by default.
- Gitignored by default in most `.gitignore` templates, and the safety check
  below adds it if missing.
- Clearly user-owned; it does not bleed into `.claude/worktrees/` (which the
  Claude Code runtime manages for its own subagent lifecycles) or into
  `.git/worktrees/` (which git owns internally).
- Easy single-`ls` discovery: `ls -d .worktrees/*`.

Priority order when selecting a directory:

1. **Existing `.worktrees/`** (hidden, canonical) — use it.
2. **Existing `worktrees/`** (visible) — use it for back-compat.
3. **`CLAUDE.md` preference** — grep for `worktree.*director` and honor the
   stated path. Useful when a project standardised on a different root
   before ANV-0155.
4. **Ask once**, then cache the answer in the repo's `CLAUDE.md`.

```bash
ls -d .worktrees 2>/dev/null || ls -d worktrees 2>/dev/null
```

If neither exists and no preference is recorded, default to `.worktrees/`.

## Safety Verification — always before first `worktree add`

A worktree directory inside the repo must be gitignored or you will commit
branch checkouts back into the main branch.

```bash
git check-ignore -q .worktrees || {
  printf '\n.worktrees/\n' >> .gitignore
  git add .gitignore
  git commit -m "chore: ignore .worktrees/"
}
```

Global worktree roots (e.g. `~/.config/aegis/worktrees/<project>/`) skip this
step because they sit outside the repo.

## Decision Forks

- **Creating a worktree?** → run the safety check above, then the creation + project-setup +
  clean-baseline command blocks in `abilities/lifecycle.md`.
- **Done with a worktree?** → use the cleanup block (`git worktree remove`, never `rm -rf`).
- **A Claude Code subagent needs isolation?** → declare `isolation: worktree` in its frontmatter
  rather than scripting `git worktree add` — see `abilities/lifecycle.md`.
- **A hook needs the canonical root from inside a linked worktree?** → use `resolveProjectRoot` /
  `findProjectRoot` (linked worktrees have no `.aegis/`); see the ability.
