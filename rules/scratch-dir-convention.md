---
name: scratch-dir-convention
description: Use when handing a subagent a file to write — never under .git/; use the self-ignoring .aegis-scratch/ dir.
visibility: user
platforms: [claude, opencode, codex, cursor, zed]
---

# scratch-dir-convention

## The rule

When you tell a subagent to write a report, brief, diff, or any intermediate
artifact to a file, that file MUST live in a writable, git-ignored working-tree
directory — never under `.git/`.

**Claude Code treats `.git/` as a protected path and DENIES agent writes there.**
A dispatch that says "write your report to a `.git/`-path file" (or any
`git rev-parse --git-path` target) fails silently: the handoff breaks and the
controller gets nothing back.

## The convention — one-shot, stateless, no runtime

Resolve a self-ignoring scratch dir at the working-tree root and hand subagents
ABSOLUTE paths inside it:

```bash
SCRATCH="$(git rev-parse --show-toplevel)/.aegis-scratch"
mkdir -p "$SCRATCH" && printf '*\n' > "$SCRATCH/.gitignore"
# e.g. dispatch a subagent to write "$SCRATCH/report-<task>.md"
```

- `git rev-parse --show-toplevel` is worktree-correct (resolves the working tree, not `.git/`).
- `printf '*\n'` writes a `.gitignore` that ignores everything including itself —
  the dir stays out of `git status` and out of accidental commits, and no tracked
  file is modified.
- Pure one-shot bash. No daemon, no state file, no cleanup hook. Re-running is idempotent.

## Why

The entire file-handoff orchestration pattern (a controller dispatches a subagent,
the subagent writes its result to a file, the controller reads it back) depends on
the write target being writable AND ignored. `.git/` satisfies neither. Pass an
absolute `.aegis-scratch/` path and the handoff is reliable, invisible to git, and
needs no teardown.

## Red flags

| Thought | Reality |
|---|---|
| "I'll have the agent write to `.git/aegis/report.md`" | Claude Code denies the write; the handoff silently breaks. Use `.aegis-scratch/`. |
| "Relative `./scratch/out.md` is fine" | A subagent's cwd may differ; relative paths drift. Hand an ABSOLUTE path. |
| "I should add a cleanup step / state file" | No — the self-ignoring `.gitignore` is the whole mechanism. Stateless by design. |
