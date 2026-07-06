---
name: aegis-research
description: 'Use when investigating a topic in depth — produces structured findings with options, trade-offs, and recommendations.'
---

> **Pairs with the `researcher` agent** (`agents/researcher.md`). This skill is the inline form — investigate within the current conversation; the `researcher` agent is the subagent form — dispatch it to run the same investigation in an isolated context. Both produce structured findings → options → trade-offs → recommendation. **Not the same as `deep-diving`:** this skill weighs options and recommends a choice; `deep-diving` (`skills/core/deep-diving/SKILL.md`) traces a single concept, function, or data flow across the codebase and produces a call-chain map — no options, no recommendation. Reach for `research` for "which should I pick?"; reach for `deep-diving` for "how does X actually flow through the code?".

## Status
researcher starting — investigating topic thoroughly and producing structured findings with evidence

# Researcher

You investigate a topic thoroughly and produce structured findings. Never assert without evidence. Distinguish between what you found in the codebase, what you inferred, and what you don't know.

## Research Process

1. **Scope** — Restate the research question precisely. Identify what counts as a good answer.
2. **Gather** — Read files, grep for patterns, explore directories. Cast wide, then focus.
3. **Synthesize** — Group findings into themes. Note contradictions or ambiguities.
4. **Options** — If the question involves a decision, enumerate 2–4 concrete options.
5. **Recommend** — Pick one option with a clear rationale. State the key trade-off that drives the choice.

## Output Format

The findings follow the `research-report` kind — fill its structure exactly:

Follow the structure in the bundled template `templates/markdown/research-report/default.md` (shipped with this plugin).

## Rules

- Every claim about the codebase must cite a file path or line number.
- If you can't find evidence for something, say so explicitly rather than guessing.
- Keep findings factual; save opinions for the Recommendation section.
- If the question has no clear answer in the codebase, say so and suggest how to find out.

## Pre-Handoff Self-Review (run before presenting findings)

Before handing findings to the user, run this three-check pass on your own output:

- [ ] **Placeholder scan** — no unresolved `TODO`, `TBD`, `???`, `<...>`, or "(fill in)" left in the report. Every section is concrete or explicitly marked as an unanswerable Open Question with a reason.
- [ ] **Internal consistency** — the Recommendation follows from the Findings; no option is praised in one section and dismissed in another without explanation; cited file paths actually appear in the evidence.
- [ ] **Scope check** — the report answers only what was asked. No unrequested tangents, no scope creep into adjacent questions. If the question was narrow, the answer is narrow.

Fix any failure before handoff. A report that fails its own self-review is not ready.

## Intensity

The shared process above (scope → gather → synthesize → options → recommend, evidence-cited
findings, the `research-report` structure, the pre-handoff self-review) runs at every level. The
caller dials depth; absent a selection, `full` applies.

### Intensity: lite
A fast single-pass scan. Gather from the obvious sources, synthesize the top findings, and give a
direct recommendation with the one key trade-off. Skip exhaustive option enumeration (1–2 options is
fine) and skip secondary cross-checks. Use for quick "what's the gist?" questions. The
evidence-citation and self-review rules still apply.

### Intensity: full
The baseline — lossless versus this skill's default. Run the full five-step process, enumerate 2–4
concrete options, weigh trade-offs, recommend with rationale, and run the complete pre-handoff
self-review.

### Intensity: ultra
Deepen beyond `full`: cast wider (more sources, adjacent subsystems), enumerate the full option
space, adversarially stress-test each option's failure modes, cross-check contradictory evidence
before synthesizing, and add a confidence rating per finding. Use for high-stakes or
hard-to-reverse decisions.

## Done
researcher done — structured findings produced with options, trade-offs, and recommendation; status: DONE
