---
kind: skill
name: default-feature
description: Use when a user requests a new feature or significant change and no more specific workflow applies — runs brainstorm → plan → implement → review → respond.
visibility: internal
platforms: [claude, opencode, codex, cursor, zed]
x-aegis:
  pipeline:
    next: design-exploration
---

# default-feature workflow

**Announce:** I'm using the default-feature workflow to run the full brainstorm → plan → implement → review → respond pipeline.

## When to use

The user has asked for a new feature, a significant refactor, or a substantive change — and no more specific workflow (debug-first, doc-only, research-only) applies. This is the fallback feature-delivery pipeline.

## Status

Starting design-exploration phase…

## Phase Sequence

This is a phase-ordered, gated chain. Progress is linear — each phase gates on the prior and may not
start until the current phase signals terminal completion (its hand-off artifact). The transition
into the chain is declared via `x-aegis.pipeline.next` (→ `design-exploration`); subsequent
transitions are documented here in prose. See `docs/workflow-guide.md` → *The phase-ordered
gated-workflow convention*.

1. **design-exploration** — explore intent, ask clarifying questions, enumerate candidate designs. Terminal marker: user-approved direction.
2. **implementation-planner** — produce a step-by-step implementation plan. Terminal marker: plan committed to the chosen location (or accepted inline).
3. **feature-developer** — execute the plan incrementally. TDD is the default discipline. Terminal marker: all plan tasks done, tests green.
4. **two-stage-review** — route the produced changes through the two-stage review loop (spec-compliance → code-quality, see below). Terminal marker: both stages pass.
5. **review-response** — applies the review's actionable items, marks others as won't-fix with reasoning. Terminal marker: every finding has a disposition.

### Review phase: the two-stage loop (gated, fail-loops-back)

The review phase does **not** run a single inline review. It invokes the `two-stage-review` skill,
which orchestrates the `code-review` instrument across two passes:

1. **Stage 1 — spec compliance.** Did the implementation deliver exactly what the plan/spec asked
   (no missing items, no scope creep)? A `SPEC_FAIL` **loops back to feature-developer** with the
   specific missing/extra/incorrect list — it does not advance to Stage 2.
2. **Stage 2 — code quality.** Is the change production-quality (correctness, architecture, security,
   performance, test quality, conventions)? A `QUALITY_FAIL` **loops back to feature-developer**
   (the fix/implement phase) with the findings — it does **not** advance forward to review-response.

Only when **both** stages pass does the workflow advance to review-response. Both stages run over the
consolidated `code-reviewer` agent (the `code-review` instrument) via `two-stage-review`; the internal
spec-compliance and code-quality reviewers are dispatch targets inside `two-stage-review`, not public
agents invoked here. A fail always routes **back** to the phase that can fix it, never forward.

## Q1 and Q2 — Location and Format (implementation-planner phase)

When advancing to implementation-planner, ask **both** questions **once**. Do not ask again when invoking
implementation-planner internally — pass `plan_location` and `plan_format` through as runtime context.
The user is asked only once across the entire workflow.

### Q1 — Location

Invoke AskUserQuestion with the following payload:

```json
{
  "question": "Where should the plan be stored?",
  "intro": "Choose where to write the plan. Location and format are independent — you will be asked about format next.",
  "options": [
    {
      "label": ".aegis/plans/<version>.plan.md (Recommended)",
      "description": "In-project plans directory; created if missing. Integrates with plan validation and execution tooling."
    },
    {
      "label": "docs/plans/<slug>.md",
      "description": "In-project public-shaped docs. Use when you want the plan in your published documentation."
    },
    {
      "label": "~/.aegis/projects/<auto-name>/plans/<slug>.plan.md",
      "description": "Out-of-project; keeps your project repo clean of generated artifacts. Only shown when ~/.aegis/ exists."
    },
    {
      "label": "Custom path",
      "description": "Relative path you provide. Must not contain \"..\" or escape the project root."
    }
  ],
  "_rationale": "Integrates with plan validation, plan execution, and the dependency graph; the directory is bootstrapped on first use."
}
```

Note: only show the `~/.aegis/projects/` option when `~/.aegis/` exists on the system.

### Q2 — Format

Invoke AskUserQuestion with the following payload:

```json
{
  "question": "What format should the plan use?",
  "intro": "Structured slate integrates with plan validation and execution tooling. Markdown is human-readable for review and discussion. Both writes two files at the chosen location.",
  "options": [
    {
      "label": "Structured slate (frontmatter + markdown body) (Recommended)",
      "description": "YAML frontmatter (executable_plan, must_haves, covered_decisions) + markdown body; consumable by plan-validate and plan-run tooling."
    },
    {
      "label": "Markdown",
      "description": "Plain markdown plan with phases and acceptance criteria; no structured frontmatter; best for human review and discussion."
    },
    {
      "label": "Both",
      "description": "Write both a structured-slate and a plain markdown file at the chosen location; use when both tooling and human audiences matter."
    }
  ],
  "_rationale": "Structured slate enables plan validation and execution via tooling; markdown serves human readers reviewing in PRs."
}
```

After the user picks location and format, pass both choices through to `aegis:implementation-planner` as `plan_location` and `plan_format`. The implementation-planner skill must not ask Q1 or Q2 again — it inherits both answers from this workflow.

## Hand-off Artifacts

| From | To | Artifact |
|---|---|---|
| design-exploration | implementation-planner | Design memo (markdown) naming chosen approach and scope. |
| implementation-planner | feature-developer | Plan file at the chosen location with tiered tasks and DAG. |
| feature-developer | two-stage-review | Commit list, test output snapshot, plan-task check-off, acceptance criteria. |
| two-stage-review | feature-developer (on fail) | Specific `SPEC_FAIL` / `QUALITY_FAIL` findings — loops back to the fix phase. |
| two-stage-review | review-response (on pass) | Merged review report (both stages passed) with severity-tagged findings. |
| review-response | (terminal) | Disposition list: applied / deferred / won't-fix with rationale. |

## Failure Propagation

If any phase returns `done_with_concerns` or `blocked`, decide whether to extend the graph (add a correction or research sub-triad) or escalate to the human operator. Document the reason for escalation before stopping.

## Why it's a composite skill

The phases are each their own atomic skill. This file binds them into a named workflow so the orchestrator can request a consistent feature-delivery pipeline with one call.

## Done — status: DONE
