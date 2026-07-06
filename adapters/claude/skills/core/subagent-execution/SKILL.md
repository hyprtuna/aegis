---
name: subagent-execution
description: 'Use when executing an implementation plan via fresh subagents — runs spec-compliance and code-quality review gates per task.'
---

> **Invoke via `Skill({skill: "aegis:subagent-execution"})`.** This is a skill, not an agent. If you reached for the Agent tool, you're using the wrong primitive.

# Subagent Executor

Execute implementation plans by dispatching one fresh subagent per task, with mandatory two-stage review (spec compliance then code quality) before any task is marked complete. Fresh subagents prevent context rot. Two-stage review prevents both spec drift and quality decay.

## Core Principle

The quality equation is simple: **fresh subagent per task + spec compliance review + code quality review = high quality without context rot.** Each subagent starts clean, receives only the context it needs, and has its work verified by independent reviewers before the next task begins. No subagent accumulates stale context from prior tasks. No implementation ships without both spec and quality gates passing.

## Before Starting

Complete all of these before dispatching the first subagent:

### 1. Read the Full Plan

Read the plan file end to end. Do not skim. You need to understand the full scope to provide correct context to each subagent and to identify cross-task dependencies.

### 2. Extract All Tasks

Build an internal list of every task with its complete text. For each task, record:

- Task number and title
- Files to create, modify, or delete
- Action description (the full text, not a summary)
- Verification command
- Acceptance criteria
- Dependencies on prior tasks

### 3. Create a Progress Checklist

Use TodoWrite to create a checklist of all tasks. This is your single source of truth for progress. Update it after each task completes. **TodoWrite state does not survive compaction -- for a long plan, also mirror each clean task into a durable append-only ledger file under `.aegis-scratch/` (see `abilities/per-task-execution-stages.md`) so a compacted controller never re-dispatches a finished task.**

### 4. Verify Worktree

If not already in a worktree, set one up. Implementation work should be isolated from the main branch. Check with `git worktree list` — if you are already in a worktree, proceed.

### 5. Read CLAUDE.md

Read the project's CLAUDE.md and any per-folder CLAUDE.md files relevant to the plan. You will pass these conventions to every subagent so they follow project standards.

## Per-Task Execution Loop

Execute tasks **sequentially, one at a time**. Never dispatch multiple implementers in parallel — file conflicts and merge pain are not worth the time savings.

The loop has five stages, run in order for every task:

- **Stage 0 — Prepare context.** Gather full task text (verbatim), relevant existing-file contents, project CLAUDE.md conventions, and any prior task outputs the new task depends on.
- **Stage 1 — Dispatch implementer.** Task() a fresh subagent with the full task text and Stage-0 context, asking for a status of DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED.
- **Stage 2 — Handle response.** DONE proceeds to review. DONE_WITH_CONCERNS gets the concerns triaged first (fix correctness issues; ignore style preferences). NEEDS_CONTEXT means re-dispatch a fresh subagent with the missing info. BLOCKED means resolve the obstacle and re-dispatch, or escalate.
- **Stage 3 — Spec-compliance review.** Fresh reviewer subagent verifies the implementation matches the task spec. PASS/FAIL with specific findings. Max 3 fix-and-re-review cycles before escalation.
- **Stage 4 — Code-quality review.** Only after Stage 3 passes. Fresh reviewer evaluates error handling, type safety, naming, coverage, patterns, duplication (confidence ≥ 80% for any flag). Max 3 cycles.
- **Stage 5 — Mark complete.** Update TodoWrite, run the plan's verification command, commit with a conventional message derived from the task title, move on.

See `abilities/per-task-execution-stages.md` for the full per-stage instructions (exact reviewer prompts, FAIL-path mechanics, max-cycle escalation) and the model-selection table (mechanical → haiku/sonnet, integration → sonnet, architecture → opus; reviewers always sonnet+).

## After All Tasks Complete

### Final Integration Review

Dispatch a fresh review subagent to review the entire implementation holistically. This reviewer sees all files changed across all tasks and checks for:

- Cross-task consistency (naming, patterns, conventions)
- Integration points (do the pieces fit together correctly?)
- Missing glue code (did any inter-task dependency get lost?)
- Test coverage of the full feature, not just individual units

### Final Test Suite

Run the full test suite: `npm test` (or the project's equivalent). Every test must pass. If tests fail:

1. Identify which task's changes caused the failure
2. Dispatch a fresh implementer to fix the specific failure
3. Re-run the full test suite
4. Repeat until green

### Completion Report

After everything passes, produce a summary:

```
## Execution Summary

**Plan:** [name]
**Tasks:** N completed, 0 skipped, 0 blocked
**Review cycles:** N total (spec: X, quality: Y, final: Z)
**Tests:** all passing

### Per-Task Summary
| # | Task | Impl Model | Spec Review | Quality Review | Commit |
|---|---|---|---|---|---|
| 1 | [title] | [model] | PASS (1 cycle) | PASS (1 cycle) | [sha] |
| 2 | [title] | [model] | PASS (2 cycles) | PASS (1 cycle) | [sha] |
| ... | ... | ... | ... | ... | ... |

### Issues Encountered
- [any blockers, escalations, or surprises worth noting]

### Files Changed
- [complete list of files created, modified, or deleted]
```

## Rules

These are hard constraints, not guidelines:

- **Never skip reviews.** Both spec compliance and code quality reviews are mandatory for every task. No exceptions for "simple" tasks — simple tasks have simple reviews.
- **Never dispatch multiple implementers in parallel.** Sequential execution prevents file conflicts and ensures each task builds on a verified foundation.
- **Never proceed with unfixed review issues.** A FAIL verdict means the task is not done. Fix and re-review.
- **Spec compliance MUST pass before code quality review starts.** There is no point reviewing the quality of code that does not meet its spec.
- **Provide full task text to every subagent.** Never tell a subagent to "read the plan" or "see task 3 above." Each subagent gets everything it needs in its dispatch prompt.
- **Hand large artifacts as files, not pasted bodies; pin explicit SHAs.** Full briefs, diffs, and implementer reports travel as file PATHS under `.aegis-scratch/` (see `rules/scratch-dir-convention.md`), not pasted inline -- pasted text stays controller-resident and is re-read every turn. Never embed a moving ref (`HEAD~1`/`HEAD`) in a dispatch prompt; resolve and pin the literal SHA. Full technique: `abilities/per-task-execution-stages.md`.
- **Fresh subagent for every dispatch.** Do not reuse a subagent for a second task or a second review cycle. Fresh context prevents accumulated confusion.
- **Max 3 review cycles per stage.** If an implementer cannot satisfy a reviewer after 3 attempts, the problem is likely in the spec or the reviewer's expectations. Escalate to the user.
- **Commit after every task.** Each task leaves the codebase in a committed, valid state. If a later task breaks something, you can identify exactly where it went wrong.
- **Hand file paths under `.aegis-scratch/`, never `.git/`.** When a stage tells a subagent to write a report or artifact to a file, use the self-ignoring scratch dir — see `rules/scratch-dir-convention.md`. Claude Code denies writes under `.git/`; that handoff silently breaks.

---

## REQUIRED SUB-SKILL: finishing-branch

After the final task in the plan passes both review stages and the last commit
lands, the next step in the SDD chain is `finishing-branch`. It owns the merge
discipline (PR / merge / keep / discard menu) and the cleanup of feature branches
and worktrees. Do not roll your own merge — the Aegis SDD chain is
`brainstorm-spec → implementation-planner → subagent-execution → finishing-branch`, and the
branch-hygiene guarantees live in finishing-branch.
