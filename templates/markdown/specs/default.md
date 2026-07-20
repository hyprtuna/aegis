---
name: specs-default
description: Spec markdown frontmatter + section shape (default variant).
visibility: internal
platforms: [claude, opencode, codex, cursor, zed]
---

```markdown
---
spec: <slug>
version: "1"
title: <human-readable title>
date: <YYYY-MM-DD>
status: draft
related_plan: <plan file path, if known>
---

# <Title>

## Goal

<One paragraph: what this spec enables and why.>

## Context

<Relevant codebase state. Layer boundaries, existing abstractions, related files.>

## Assumptions

- A-001: <assumption>
- A-002: <assumption>
...

<decisions>
- id: D-01:
  title: <decision title>
  status: locked
  rationale: <why this choice over the alternative>

- id: D-02:
  title: <decision title>
  status: deferred
  rationale: <deferred until <trigger>; why not decided now>

- id: D-03:
  title: <decision title>
  status: discretionary
  rationale: <implementer's choice within <stated bound>>
</decisions>

## Acceptance Criteria

- [ ] <verifiable criterion>
- [ ] <verifiable criterion>
...

## Out of Scope

- <explicitly excluded item>
- <explicitly excluded item>

## Open Questions

- (none)
```

The `<decisions>` block MUST use this exact format — one entry per `- id:` bullet with `title:`, `status:`, and `rationale:` fields on indented lines, and **decision IDs must follow the `D-NN:` convention** (`D-01:`, `D-02:`, …) — so that decision-checking tooling can parse it correctly and plan verifiers can regex-match `covered_decisions`.

The `status:` field carries the **tri-partition** (the inline-format counterpart of the Locked/Deferred/Discretionary subsections in the `decisions` template): `locked` (decided and binding), `deferred` (not decided yet — `rationale` states the trigger), or `discretionary` (implementer's choice within stated bounds). Every decision carries exactly one status.
