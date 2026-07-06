# Structured Spec Extras — Decisions Grammar and Compliance

> Loaded by the `brainstorm-spec` skill when the user picks **Structured-spec** or **Both**
> as the spec format (Q2), regardless of which location was chosen in Q1. Extends the generic
> brainstorm-spec body with the decisions block grammar, D-NN decision ID convention, SDD layout
> requirements, and plan-verifier compliance rules.

## When This Addendum Applies

The user chose **Structured-spec** or **Both** as the format (Q2). This triggers:

1. If location is `.aegis/specs/features/<slug>/`: bootstrap with `mkdir -p .aegis/specs/features/<slug>/` (silent, no confirmation needed).
2. Apply the structured spec format defined below, including the `<decisions>` block.
3. `plan-check-decisions` integration is active — every decision ID must be traceable from the plan.
4. `plan-verifier` compliance rules apply when the linked plan is validated.

## Mandatory `<decisions>` Block

Every structured spec MUST include a `<decisions>` block using this grammar:

```markdown
<decisions>

D-01: <Short decision title>
  Question: <The design question being decided>
  Options:
    A. <Option A description>
    B. <Option B description> (chosen)
  Rationale: <Why option B was chosen>

D-02: <Short decision title>
  Question: <The design question being decided>
  Options:
    A. <Option A description> (chosen)
    B. <Option B description>
  Rationale: <Why option A was chosen>

</decisions>
```

### D-NN Decision ID Format

Decisions are identified using the format `D-NN` where `NN` is a zero-padded two-digit number
starting at `D-01`. When `implementation-planner` references a spec decision in a plan task, it uses the
exact `D-NN:` ID as it appears in this spec's `<decisions>` block.

`plan-verifier` performs a regex lookup on `must_haves.covered_decisions` to verify every
`D-NN:` ID from this spec's `<decisions>` block is addressed by the plan. A missing or
malformed ID breaks that lookup.

**You must produce at least one `D-NN:` decision for any non-trivial structured spec.**

## YAML Frontmatter Schema

Structured specs MUST include YAML frontmatter:

```yaml
---
title: "<Feature Name>"
slug: "<kebab-slug>"
created: "<ISO-date>"
status: "draft"
related_plan: ""          # filled after implementation-planner runs
decisions_count: N        # number of D-NN decisions in the <decisions> block
---
```

## SDD Layout

When writing to `.aegis/specs/features/<slug>/`, follow the SDD directory layout:

```
.aegis/specs/features/<slug>/
  spec.md          ← this file (the structured spec)
  plan.md          ← produced by implementation-planner (after spec approval)
```

The canonical location is `.aegis/specs/features/<slug>/spec.md` — referenced via `related_spec:`
in the plan frontmatter or passed explicitly as `Spec file: <path>`.

## Structured Spec Full Format

```markdown
---
title: "Feature Name"
slug: "feature-name"
created: "YYYY-MM-DD"
status: "draft"
related_plan: ""
decisions_count: 2
---

## Goal

<One paragraph: what the feature does and why it is needed.>

## Context

<Codebase summary relevant to the goal: relevant existing files, patterns, constraints.>

## Assumptions

- A-001: <assumption> — evidence: <file:line or grep pattern>
- A-002: <assumption> — evidence: <file:line or grep pattern>

<decisions>

D-01: <Short decision title>
  Question: <The design question being decided>
  Options:
    A. <Option A>
    B. <Option B> (chosen)
  Rationale: <Why option B>

</decisions>

## Acceptance Criteria

- <Machine-verifiable criterion 1>
- <Machine-verifiable criterion 2>

## Out of Scope

- <Explicit exclusion 1>
- <Explicit exclusion 2>

## Open Questions

- (none)
```

## assumptions-surfacer Integration

After producing the initial spec draft and `<decisions>` block, dispatch the
`assumptions-surfacer.md` sub-task. Any assumption it marks `elevation: yes`
MUST become a `D-NN:` decision in this spec before `implementation-planner` runs.

The sub-task chain is:
```
brainstorm-spec → assumptions-surfacer → [D-NN elevations] → implementation-planner → plan-verifier
```

## plan-verifier Compliance

Once the linked plan is written, plan validation verifies:
- Every `D-NN:` ID from this spec's `<decisions>` block appears in `covered_decisions` of the plan.
- `related_spec:` field in the plan frontmatter points to this spec file.

## Quality Checklist (Structured-spec additions)

In addition to the base quality checklist, also verify:

- [ ] Every decision follows the four-part structure (Question / Options / chosen / Rationale).
- [ ] All decision IDs follow the `D-NN:` convention (`D-01:`, `D-02:`, …).
- [ ] The `<decisions>` block is syntactically valid (parseable by decision-coverage tooling).
- [ ] `decisions_count` in frontmatter matches the actual number of `D-NN:` entries.
- [ ] The spec path matches the `related_spec:` field the plan will reference.
