---
kind: skill
name: code-review
description: Use when reviewing diffs or files for quality, security, style, or test coverage — emits severity-graded findings (>=80% confidence) plus a fail-closed top-level verdict.
visibility: user
platforms: [claude, opencode, codex, cursor, zed]
x-aegis:
  intensity:
    default: full
    levels: [lite, full, ultra]
x-claude:
  agent: code-reviewer
  argument-hint: "[target] [--type spec-compliance|code-quality|both] [--strict] [--lite|--ultra]"
  primitiveHint: skill
---

## Status
code-reviewer starting — reviewing code changes with severity-graded findings at >=80% confidence

**Announce:** I'm using the code-review skill to identify severity-graded findings in the diff or files under review.

# Code Reviewer

> **Review-cluster role: instrument.** `code-review` is the instrument that *performs* a
> review — it produces the severity-graded findings. The review *workflows* —
> `review-requesting`, `review-response`, and `two-stage-review` — call this skill rather than
> re-implement reviewing. When you need findings, this is the skill; when you need to request,
> respond to, or orchestrate reviews, reach for one of those workflows.

Review with rigor. Report only findings you're >=80% confident about.

${TEMPLATE:code-review}

The line above resolves to the **markdown default** of the `code-review` kind, which is the
authoritative review body — it owns the layout, section order, and severity taxonomy. Do not
restate those here.

## Output location & format

This skill is **template-authoritative** (see `rules/templates.md`). It carries only the
template reference above; it does not duplicate format or layout prose. The JSON deliverable
carries a top-level, fail-closed `verdict: "PASS" | "FAIL"` alongside `spec_compliance` /
`code_quality` / `min_confidence` — the full FAIL rule (Critical finding, Pass-1 GATE, absent/
ambiguous report, or an unacknowledged `--strict` lock-in finding) lives in `agents/code-reviewer.md`
(Output Format), which owns the ReviewReport schema; do not restate the rule here.

For the location/format question flow — where to write the artifact (Q1) and which of the kind's
shipping formats to use (Q2, including the JSON variant for tooling-consumable findings) — follow
`rules/user-choice-discipline.md`. That rule reads the `code-review` kind's available formats from
`manifest/template-index.json` and handles prompt-override parsing, preference persistence, and
directory bootstrap. Do not re-implement the Q&A here.

## Rules

Skip style/taste issues unless they violate declared project conventions (CLAUDE.md, .editorconfig, lint config).

For the code-quality pass, [`abilities/fowler-code-smells.md`](./abilities/fowler-code-smells.md)
gives a compact Fowler 12-smell baseline — judgement-call heuristics that prompt scrutiny, never
hard rules; repo/project standards always override them.

## Intensity

The shared review behavior above (severity-graded findings, the template-authoritative body, the
>=80% confidence bar) runs at every level. The caller dials effort with `--lite` / `--ultra`; absent
a flag, `full` applies.

### Intensity: lite
One focused pass over the diff. Report only **high-severity** correctness and security findings at
the >=80% bar; skip the optional sibling sub-tasks below and skip style/convention nitpicks
entirely. Use for fast pre-commit sanity checks.

### Intensity: full
The baseline — lossless versus this skill's default. Run the full severity-graded review across
correctness, security, style-vs-convention, and test coverage at the >=80% bar, and reach for the
sibling sub-tasks when the target warrants them.

### Intensity: ultra
Deepen beyond `full`: always run both sibling sub-tasks (comment analysis + TypeScript type-design
audit) when applicable, add an adversarial lock-in / irreversible-decision pass (the
`code-reviewer --strict` lens, `min_confidence: 0`), and widen coverage to performance and
architecture-boundary findings. Use before irreversible or high-blast-radius changes.

## Sibling sub-tasks

Two semantic review passes are available as sibling prompt files, dispatched via
`Task(general-purpose)` rather than as named agents:

- **Comment review (staleness / contradiction / AI-slop).** Dispatch
  `Task(general-purpose)` with the body of
  [`abilities/comment-analyzer.md`](./abilities/comment-analyzer.md) when the
  reviewer needs LLM-grade semantic comment findings beyond regex-grade checks.
  Emits structured output.

- **TypeScript type-design audit.** Dispatch `Task(general-purpose)` with the
  body of [`abilities/type-design-analyzer.md`](./abilities/type-design-analyzer.md)
  when the review target is TypeScript-heavy and you want to catch unnecessary
  optionality, over-wide unions, missing brand types, or under-constrained
  generics.

Both prompts are read-only — they emit findings and never edit code.

## Done
code-reviewer done — all findings reported with severity tags and file:line references; status: DONE
