---
name: plan-structure-audit
description: 'Use when verifying an implementation plan against its stated goal — goal-backward analysis catches gaps, incorrect assumptions, missing steps.'
---

> **Invoke via `Skill({skill: "aegis:plan-structure-audit"})`.** This is a skill, not an agent. If you reached for the Agent tool, you're using the wrong primitive.

# Plan Verifier

**Announce:** I'm using the plan-structure-audit skill to verify an implementation plan against its stated goal using goal-backward analysis.

You verify that an implementation plan will actually achieve its stated goal. Work backwards from the goal to the steps, not forwards from the steps to the goal.

## Verification Method

1. **Goal extraction** — What is the plan trying to accomplish? State it precisely.
2. **Goal-backward analysis** — Starting from the goal, what conditions must be true for it to be met? Trace backwards to identify what each step must deliver.
3. **Gap analysis** — Are there steps missing that are required to meet a condition? Are any steps unnecessary?
4. **Assumption audit** — What does the plan assume about the current state? Verify each assumption against the codebase.
5. **Risk identification** — What could go wrong? Which risks are unmitigated?

## What to Check

- **Coverage** — Do the steps collectively deliver everything the goal requires?
- **Ordering** — Are steps in the right sequence? Would any step fail because a dependency hasn't been created yet?
- **Scope creep** — Do any steps go beyond what the goal requires?
- **Testability** — Is there a way to verify each step succeeded?
- **Reversibility** — Which steps are hard to reverse? Is there a rollback plan?
- **Missing context** — Does the plan account for existing code that might conflict?

## Prompt override (parse before asking)

Before presenting any question, scan the user's prompt for a location override:

```
regex: /store (this )?(at|in|to) (\S+)/i
```

If matched, use the captured path as the Q1 answer without asking Q1.

## Q1 — Location

Invoke AskUserQuestion with the following payload:

```json
{
  "question": "Where should the verification report be stored?",
  "intro": "Choose where to write the verification report. Location and format are independent — you will be asked about format next.",
  "options": [
    {
      "label": ".aegis/reviews/<slug> (Recommended)",
      "description": "In-project reviews directory; created if missing. Integrates with reporting commands."
    },
    {
      "label": "docs/reviews/<slug>",
      "description": "In-project public-shaped docs; visible in rendered documentation."
    },
    {
      "label": "~/.aegis/projects/<auto-name>/reviews/<slug>",
      "description": "Out-of-project; keeps your project repo clean. Only shown when ~/.aegis/ exists."
    },
    {
      "label": "Custom path",
      "description": "Relative path you provide. Must not contain \"..\" or escape the project root."
    }
  ],
  "_rationale": "Co-located with the project and accessible to reporting commands."
}
```

Note: only show the `~/.aegis/projects/` option when `~/.aegis/` exists on the system.

After the user picks:
- `.aegis/reviews/<slug>` → `mkdir -p .aegis/reviews/` if missing.
- `docs/reviews/<slug>` → no directory creation needed.
- `~/.aegis/projects/` → use the out-of-project path as-is.
- Custom path → validate: must be relative, no `..` segments, no cwd escape.

## Q2 — Format

The option set is **index-driven**: the `plan-audit-report` kind declares
`formats: { html, markdown, json }` in `manifest/template-index.json` with `default: markdown`,
so Q2 offers Markdown, HTML, and JSON, with Markdown (the default) marked Recommended.

Invoke AskUserQuestion with the following payload:

```json
{
  "question": "What format should the verification report use?",
  "intro": "Choose based on who will read the report. The options below are the formats the plan-audit-report kind ships per manifest/template-index.json. Format is independent of where the file is stored.",
  "options": [
    {
      "label": "Markdown (Recommended)",
      "description": "Human-readable report with verdict and analysis sections; renders in PRs and on GitHub. The plan-audit-report kind's default format."
    },
    {
      "label": "HTML",
      "description": "Standalone stakeholder deliverable — verdict, coverage, and gaps as a self-contained page. Best when sharing outside the repo."
    },
    {
      "label": "Structured JSON",
      "description": "Machine-readable report consumable by tooling and CI; best when automated processing is needed."
    }
  ],
  "_rationale": "Markdown is the default and serves PR/GitHub readers; HTML and JSON come straight from the kind's index entry — no hardcoded format list."
}
```

## Load addendum if needed

When the user picks **Structured JSON** as the format, load
[`abilities/validation-map-schema.md`](./abilities/validation-map-schema.md) for the
structured JSON schema. The markdown and HTML paths use the generic report body below.

## Output Format (generic)

```
## Goal

<Precise restatement of what the plan must achieve>

## Verdict

PASS — plan achieves the goal
PASS WITH CONCERNS — achieves goal but has risks
FAIL — plan does not achieve the goal

## Analysis

### Gaps
- <Missing step or condition that the plan doesn't address>

### Incorrect Assumptions
- <Assumption that doesn't hold, with evidence from codebase>

### Ordering Issues
- <Step X requires Y which comes after it>

### Risks
- <Risk description> — Mitigation: <suggestion>

## Suggested Changes

<Specific additions, removals, or reorderings needed>
```

## Rules

- Report only what you can verify. If you can't check an assumption from the codebase, flag it as unverified.
- Don't rewrite the plan. Identify gaps and let the user decide how to fill them.
- A plan that achieves the goal through a suboptimal path is still a PASS — note it as a concern, not a failure.

## Sibling sub-task: retroactive-validator

For plans that have already been executed, dispatch a read-only coverage audit as a
`Task(general-purpose)` sub-task using the body of
[`abilities/retroactive-validator.md`](./abilities/retroactive-validator.md).

The sub-task walks the executed plan, classifies each task as
`covered | partial | uncovered`, and emits a structured coverage report. Use this
when verifying a plan whose implementation has already merged and needs a retroactive
coverage audit.

When the report format is Structured JSON, also load `abilities/validation-map-schema.md` to
get the structured JSON schema.
