---
name: implementation-planner
description: Use when an approved spec exists and an implementation plan with phases, MustHaves frontmatter, and verification gates is needed
visibility: internal
platforms: [claude, opencode, codex, cursor, zed]
x-claude:
  primitiveHint: skill
---

# Plan Writer

**Announce:** I'm using the implementation-planner skill to produce a complete, phase-ordered implementation plan with MustHaves frontmatter and verification gates.

You write implementation plans that are executable instructions, not wish lists. A plan must contain enough detail that an agent with zero prior context can execute it successfully, producing working software with passing tests.

## Status

Reading spec and project context…

## Prompt override (parse before asking)

Before presenting any question, scan the user's prompt for a location override:

```
regex: /store (this )?(at|in|to) (\S+)/i
```

If matched, use the captured path as the Q1 answer without asking Q1. Continue to Q2 (format) regardless — a prompt-time location override does not imply a format preference.

## Preference check (before asking)

If `plan_location` was passed by the caller (e.g. from `default-feature`), use it and skip Q1. Do not ask Q1 again — the user already answered via the calling workflow.

Otherwise, consult the host preference store for a previously persisted plan location and format. If found, skip Q1/Q2 accordingly.

## Q1 — Location and Q2 — Format

Ask Q1 (location) then Q2 (format) via AskUserQuestion. See `abilities/question-payloads.md` for the exact JSON payloads and the post-pick handling per choice. Skip questions per the preference check above. Only show the `~/.aegis/projects/` option when `~/.aegis/` exists on the system.

Q1 options: `.aegis/plans/<version>.plan.md` (recommended), `docs/plans/<slug>.md`, `~/.aegis/projects/<auto-name>/plans/<slug>.plan.md`, or a custom relative path.

Q2 options: Structured slate (frontmatter + body — recommended), Markdown (human-readable, no frontmatter), or Both.

## Load addendum if needed

When the user picks **Structured slate** or **Both** as the format, load
[`abilities/structured-slate-extras.md`](./abilities/structured-slate-extras.md) for the
structured frontmatter schema, decision traceability grammar, compliance rules, and the
executable YAML task schema. The markdown-only path uses just the generic plan body below.

## Persist preferences

After both Q1 and Q2 are answered (or resolved from preferences/override), persist the
selections in the host preference store. On subsequent invocations the skill reads this
preference and skips both questions.

## Before Writing the Plan

Do all of this before drafting a single task:

1. **Read the spec or design doc** (if one exists). Understand the full scope.
2. **Read CLAUDE.md** at the project root and in any relevant subdirectories. Lock in conventions, tech stack, test framework, import rules.
3. **Map the file structure.** Use Glob and Grep to determine which files exist, which need to be created, and which need modification. Record exact paths.
4. **Identify dependencies.** Note libraries, internal modules, and type definitions the work will touch.
5. **Lock in decomposition decisions.** Decide the task boundaries before writing any tasks. Changing the decomposition mid-plan produces incoherent ordering.

## No Placeholders Rule

A plan verifier rejects forbidden placeholder tokens (`TBD`, `XXX`, `???`, `…`, `TODO`, `implement later`, `as needed`, `handle errors appropriately`, and similar vague directives). Every step must have complete, concrete details — research an unknown before writing the task, or raise it as a blocking open question. See `abilities/plan-quality-rules.md` for the full forbidden-token table.

**Reference the spec; don't restate it.** The spec owns the WHAT/WHY (requirements, acceptance criteria, decisions); the plan owns the HOW (tasks, files, code, commands) and cites the spec by path and section. Reconciled with No-Placeholders: No-Placeholders means repeat *code and commands* WITHIN the plan; copying requirement *prose* FROM the spec is the different thing to avoid — turn it into a concrete action. Two narrow exceptions travel verbatim into the plan (a subagent sees only its task, never the spec): the `## Global Constraints` section and each task's `**Interfaces:**` block.

## Plan Structure

Every plan follows this format exactly:

${TEMPLATE:plans}

When the user picks **Structured slate** or **Both** as the format, also apply the additional
format requirements defined in `abilities/structured-slate-extras.md` (loaded automatically).
The addendum adds the structured frontmatter block, the executable task YAML, composition
table, and decision traceability requirements. The location choice does not determine whether
the addendum applies — the format choice does.

### Decision Template

When the plan itself needs a decision from the user (a forking choice within the plan, a tool selection, an order-of-operations preference), render it through the canonical decision template and wait per the `decision-template-discipline` rule — never silently commit to the recommendation:

${TEMPLATE:decisions}

## What Every Task Must Have

Every task specifies **Files** (exact paths), **Action** (complete code or unambiguous instructions), **Verification** (runnable command + expected output), and **Acceptance** (observable, binary criteria) — see `abilities/plan-quality-rules.md` for per-field bad/good examples. Each task also carries an **Interfaces:** block (Consumes / Produces — exact signatures), and the plan carries a top-level `## Global Constraints` section when the spec has project-wide requirements (version floors, naming/copy rules, platform reqs — exact values verbatim). The `plans` template (`templates/markdown/plans/default.md`) shows the markdown shape; `abilities/structured-slate-extras.md` the structured-slate schema.

## Plan Construction Rules

Apply these before finalizing — full detail in `abilities/plan-quality-rules.md`:

- **Task granularity** — 2–10 min per task, independently verifiable, one commit boundary; the right-sizing test (split only where a reviewer could reject one task while approving its neighbor).
- **Scope check** — split multi-subsystem plans; >15 tasks is a warning sign, >20 means it's too large; flag any task depending on work outside this plan.
- **Dependency ordering** — no forward references; the first task runs on the current tree as-is; the last task includes a final integration-verification step.

## Inline Self-Review (mandatory before declaring done)

Before saving, run the pre-handoff pass: placeholder scan, internal consistency (no forward references; phase order dependency-correct; every spec acceptance criterion maps to a task), and scope check. Then run the full 7-box checklist (phase order, TDD discipline, EXTEND/NEW tagging, observable acceptance, named risks, runnable verification commands, no forbidden placeholders) — see `abilities/plan-quality-rules.md` for the full checklist.

## After Writing

Offer the user a choice:

1. **Execute inline** — for small plans with fewer than 5 tasks, execute sequentially in the current session.
2. **Execute via subagent-driven development** — for larger plans, hand off to the `feature-developer` skill or dispatch parallel agents for independent tasks.
3. **Review first** — the user wants to read and possibly edit the plan before any execution.

Default to option 3 unless the user has explicitly asked for immediate execution.

---

## REQUIRED SUB-SKILL: subagent-execution

When option 2 is selected (or for any plan with ≥5 tasks), the next step in the chain is `aegis:subagent-execution`. It owns the per-task dispatch with two-stage review (spec compliance → code quality) and is the authoritative way to walk a plan from draft to merged. Do not roll your own dispatch loop — the chain is `brainstorm-spec → implementation-planner → subagent-execution → finishing-branch`, and the quality gates live in subagent-execution's review cycles.

## Done — status: DONE
