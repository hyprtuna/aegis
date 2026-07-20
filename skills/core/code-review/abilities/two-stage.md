## Status
two-stage-review starting — dispatching spec-compliance reviewer then code-quality reviewer

# Two-Stage Review

> **Review-cluster role: workflow.** This is a workflow that orchestrates the `code-review`
> skill (the instrument) across two passes. Each stage dispatches a reviewer that performs the
> `code-review`; this skill sequences and gates them, it does not re-implement reviewing.

**Announce:** Routing through two-stage review — Stage 1 spec compliance, then Stage 2 code quality.

This skill orchestrates a two-stage review framework: first spec compliance, then code quality.
Any executor agent can call this skill instead of inlining the two-pass review mandates.

## When to Use

- An implementer has returned a tested increment and you need both a spec-compliance check and a
  code-quality check before the work is marked DONE.
- An executor agent would otherwise inline two separate review mandates — call this instead.

The destination/format questions (Q1/Q2 + the location override regex), the verbatim per-stage
dispatch prompts, the structured `ReviewReport` schema, and the merged-result shape all live in
`two-stage/io-and-prompts.md`. This body carries the ordering, the two gates, and the decision forks.

**Dispatch doctrine (how you brief each reviewer).** Copy the spec's acceptance criteria and
constraints **verbatim** into the prompt (attention-lens); never tell the reviewer what to conclude
("don't flag X" / "treat as Minor" / "the plan chose X" → stop and remove it); brief that the
implementer's report is *unverified claims* (a stated rationale never downgrades severity); and give
the reviewer a third verdict — `⚠️ Cannot verify from diff` — for requirements in unchanged code or
spanning tasks (the controller resolves those, the reviewer does not crawl the codebase). Full
wording in `two-stage/io-and-prompts.md`.

## Setup — ask before reviewing

1. Resolve the report **location** (Q1) and **format** (Q2). See `two-stage/io-and-prompts.md` for
   the exact AskUserQuestion payloads and the `store … at/in/to <path>` prompt-override regex that
   skips Q1 when the user already named a path.

---

## Stage 1: Spec Compliance (gate)

Dispatch a **read-only** subagent (Read, Grep, Glob only) against the plan's acceptance criteria.
Use the Stage 1 dispatch prompt in `two-stage/io-and-prompts.md`.

- `SPEC_PASS` → proceed to Stage 2.
- `SPEC_FAIL` → send the specific failure list back to the implementer, re-dispatch Stage 1, loop
  until `SPEC_PASS` (max 3 loops before escalating to the user with the full failure report).

**Do not proceed to Stage 2 until Stage 1 passes.**

---

## Stage 2: Code Quality (gate)

Dispatch a second **read-only** subagent (Read, Grep, Glob only) across the six quality dimensions.
Use the Stage 2 dispatch prompt in `two-stage/io-and-prompts.md`.

- `QUALITY_PASS` → task is ready to mark DONE.
- `QUALITY_FAIL` → send the specific findings back to the implementer, re-dispatch Stage 2, loop
  until `QUALITY_PASS` (max 3 loops before escalating).

**Do not mark the task DONE until both stages pass.**

---

## Decision Forks

- **Called from an executor agent?** → pass task name, acceptance criteria, and changed files; block
  on any FAIL. See the executor-prompt snippet in `two-stage/io-and-prompts.md`.
- **Both stages passed?** → merge the two pass objects into one report (shape in the ability) and
  mark DONE only when both `passed` fields are `true`.
- **Need structured output?** → the `ReviewReport` schema + severity grades + `--strict` behavior
  live in the `code-reviewer` agent (there is no separate addendum file).

---

## Done
two-stage-review done — both review stages complete; merged report produced; status: DONE
