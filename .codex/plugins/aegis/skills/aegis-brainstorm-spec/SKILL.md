---
name: aegis-brainstorm-spec
description: 'Use when the user describes a feature without an approved spec; output is a structured spec with an Assumptions section, a decisions block, and an Open Questions section'
---

# Brainstorm Spec

**Announce:** I'm using the brainstorm-spec skill to transform an under-specified goal into a rigorous, approval-gated spec before any planning or implementation begins.

<HARD-GATE phase="research→spec">
DO NOT write implementation files, create plan files, or invoke implementation-planner until the
user has reviewed and explicitly approved the spec you produced.

letter = spirit: the intent of this gate is that no implementation work begins before
the spec's assumptions, decisions, and acceptance criteria are agreed upon. Emitting a
"looks good" and moving forward violates the gate — you must receive explicit approval.

This gate lifts ONLY when the user responds with explicit confirmation:
"approved", "looks good, proceed to plan", "go ahead", or equivalent.
A vague acknowledgment ("ok", "sure", "yes") is not approval.

Gate checklist before exiting:
- [ ] Spec file written with all required sections (Goal, Context, Assumptions,
      Decisions, Acceptance Criteria, Open Questions, Out of Scope)
- [ ] ## Open Questions section present (even if empty: "- (none)")
- [ ] Approval handshake emitted (one-line summary + "confirm before running implementation-planner")
- [ ] User has replied with explicit approval
</HARD-GATE>

## Purpose

Generate a spec file that:

1. Captures all non-obvious assumptions derived from the codebase scan.
2. Records explicit architectural decisions with rationale.
3. Defines acceptance criteria that the implementation must satisfy.
4. Provides enough context for `implementation-planner` to produce a complete plan without asking for clarification.

The output file is the single source of truth for a feature or change.

## Sibling sub-task: assumptions-surfacer

After producing the initial spec draft and decisions, dispatch a read-only
sub-task to surface hidden assumptions before the spec is approved for implementation-planner.

**Dispatch:** `Task(general-purpose)` with the body of
[`abilities/assumptions-surfacer.md`](./abilities/assumptions-surfacer.md) as the prompt.

The sub-task returns an `A-NNN:` numbered list with codebase citations and a
recommendation on whether each assumption should be elevated to a formal decision.
Any assumption marked `elevation: yes` MUST become a decision before `implementation-planner` runs.

## Inputs

Accept any of the following from the user:

| Input | Description |
|---|---|
| Goal statement | A natural-language description of the feature or change |
| `--assumptions-first` | Skip open-ended Q&A; enumerate assumptions from codebase scan, ask for corrections only (see §Assumptions-First Mode) |
| `Spec file: <path>` | Path to an existing partial spec to enrich |
| `Plan file: <path>` | Path to a plan that should be retroactively backed by a spec |

## Prompt override (parse before asking)

Before presenting any question, scan the user's prompt for a location override:

```
regex: /store (this )?(at|in|to) (\S+)/i
```

If matched, use the captured path as the Q1 answer without asking Q1. Continue to Q2 (format) regardless.

## Q1 — Location and Q2 — Format

Ask Q1 (location) then Q2 (format) via AskUserQuestion. See `abilities/question-payloads.md` for the exact JSON payloads and post-pick handling. Only show `~/.aegis/projects/` when that path exists on the system.

Q1 options: `.aegis/specs/features/<slug>/spec.md` (recommended), `docs/specs/<slug>.md`, `~/.aegis/projects/<auto-name>/specs/<slug>.md`, or a custom relative path. After picking, bootstrap the directory silently; validate custom paths for `..` and cwd-escape.

Q2 options: Structured-spec (decisions block + numbered IDs — recommended; required by implementation-planner/plan-verifier), Markdown (human-readable, no tooling), or Both. The structured path triggers the SDD layout — see `abilities/structured-spec-extras.md` for the grammar.

## Load addendum if needed

When the user picks **Structured-spec** or **Both** as the format, load
[`abilities/structured-spec-extras.md`](./abilities/structured-spec-extras.md) for the structured decisions block grammar,
D-NN decision ID convention, and plan-verifier compliance requirements. The markdown-only
path uses just the generic spec body below — do not load the addendum.

## Process

The five-step process produces the spec body:

1. **Codebase Scan** — read CLAUDE.md, glob/grep the relevant directories, identify abstractions, layer boundaries, naming, test patterns. Record findings as assumption candidates.
2. **Assumption Extraction** — number each non-obvious assumption A-001, A-002, …
3. **Decision Derivation** — promote any assumption with 2+ reasonable alternatives into a numbered D-NN decision (question, options, chosen option, rationale). At least one decision per non-trivial spec.
4. **Open Questions** — list ambiguities the scan could not resolve, ask the user, wait for answers. Skipped in `--assumptions-first` mode. The `## Open Questions` section is mandatory in every spec output, even if empty (`- (none)`).
5. **Spec Authoring** — write the spec with frontmatter + `## Goal`, `## Context`, `## Assumptions`, decisions section (format per Q2), `## Acceptance Criteria`, `## Out of Scope`, `## Open Questions`.

See `abilities/process-steps.md` for the full per-step instructions and assumption-type taxonomy.

## Output Format

Follow the structure in the bundled template `templates/markdown/specs/default.md` (shipped with this plugin).

## Assumptions-First Mode

Invoke by including `--assumptions-first` in your input. Skips open-ended Q&A: scan → enumerate A-NNN list → ask the user to correct any wrong assumptions → derive decisions → write spec. Faster for experienced users. See `abilities/process-steps.md` for the full mode spec including the user-message template.

---

## User-Approval Handshake (mandatory before exit)

After writing the spec file, you MUST emit this one-line approval prompt and then STOP.
Do not proceed to implementation-planner, implementation, or any further action until the user
explicitly confirms.

Emit exactly:

> **Spec drafted at `<path>`. Review and confirm before running implementation-planner.**

Then wait. Do NOT continue. Do NOT call `implementation-planner`. Do NOT summarize next steps beyond
the one-line above. The HARD-GATE lifts only after the user's explicit approval response.

---

## REQUIRED SUB-SKILL: implementation-planner

After the user has explicitly approved the spec, the next step in the chain is
`aegis:implementation-planner`. Hand the approved spec path to implementation-planner and let it produce the
phased implementation plan. Do not skip implementation-planner in favor of inline planning,
even for "small" specs. The canonical chain is `brainstorm-spec → implementation-planner → subagent-execution → finishing-branch` — quality gates live in `subagent-execution`'s two-stage review cycles.

---

## Pre-Handoff Self-Review (run before the approval handshake)

Run this three-check pass on the spec you wrote before emitting the handshake. A spec that fails any check is not ready — fix it first.

- [ ] **Placeholder scan** — no unresolved `TODO`, `TBD`, `???`, `<...>`, or "(fill in)" anywhere. Unresolved items belong in `## Open Questions` with a reason, not as bare placeholders.
- [ ] **Internal consistency** — every assumption involving a choice maps to a decision; no decision contradicts an assumption; every acceptance criterion is verifiable and reachable given the decisions.
- [ ] **Scope check** — covers only what was asked. Anything beyond the request is in `## Out of Scope` or removed — no silent scope creep.

Also confirm: the spec is self-contained (a reader who hasn't seen the conversation can understand it); `## Open Questions` is present (`- (none)` if empty); and, for the Structured-spec format, the checks in `abilities/structured-spec-extras.md` are satisfied.
