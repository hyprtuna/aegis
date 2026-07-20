# HTML Templates Gallery

A reference gallery of the 22 standalone HTML templates that ship under
`templates/html/`. Each is a self-contained, inline-CSS deliverable an agent
fills by slot (it renders the slots, not the whole file). For authoring rules,
slot syntax, and the format resolver, see [`docs/templates.md`](templates.md).

## How to read an entry

- **Slots** lists the required slots; optional slots are summarised by count.
  Repeating slots end in `[]` and have a `shape` in the sibling manifest.
- **Producer** names the skill or agent wired to emit the kind via
  `${TEMPLATE:<kind>}`. "General-purpose" means no single producer is wired —
  any agent may render it. "Design-only" kinds (`designOnly: true` in
  `manifest/template-index.json`) are visual references with no near-term
  producer.
- **Siblings** notes the Markdown and/or JSON formats the same kind also ships,
  per the format index. HTML-only kinds say so.

The authoritative slot data is each `templates/html/<name>.template.json`;
the authoritative format and producer map is `manifest/template-index.json`.
Three templates (`prototype-animation`, `prototype-interaction`,
`prompt-tuner`) carry minimal self-contained JavaScript under the
exception; the other 19 are zero-JS.

## Review

### code-review

- Code-review writeup: PR header, summary, severity-graded findings, coverage
  notes, reviewer sign-off.
- Slots: `title`, `summary`, `findings[]`, `signoff`, `reviewer.initials`,
  `reviewer.name`, `reviewer.verdict`, `reviewer.note` (+ 6 optional).
- Producer: `code-review` skill (paired with the `code-reviewer` agent).
- Siblings: Markdown (default), JSON.

### pr-writeup

- Pull-request writeup for reviewers: TL;DR, before/after motivation, a
  file-by-file tour with code, review-focus callouts, test plan, staged rollout.
- Slots: `title`, `pr.number`, `summary`, `changes[]`, `testPlan[]` (+ 8
  optional).
- Producer: the `finishing-branch` skill and the `git-workflow` skill's `github` fragment.
- Siblings: Markdown.

## Plan

### implementation-plan

- Implementation plan: goal, architecture summary, phased timeline with tasks,
  acceptance criteria, validation evidence.
- Slots: `title`, `goal`, `phases[]`, `acceptanceCriteria` (+ 6 optional).
- Producer: general-purpose.
- Siblings: Markdown, JSON.

### plan-audit-report

- The plan-verifier's verification report: Plan/Goal/Verdict header, requirement
  coverage, gaps, extras, file references, ordering issues, task-quality notes,
  a complete-tasks tally, and a verdict rationale.
- Slots: `title`, `planName`, `goal`, `verdict`, `coverage[]`, `tasksComplete`,
  `verdictRationale` (+ several optional list slots).
- Producer: `plan-verifier` agent.
- Siblings: Markdown (default), JSON.

## Research

### research-report

- Research report: sourced findings, a grid of 2-4 option cards with pros/cons,
  and a highlighted recommendation with the key trade-off.
- Slots: `title`, `findings`, `option[]`, `recommendation`, `keyTradeoff`
  (+ 1 optional).
- Producer: `research` skill.
- Siblings: Markdown (default), JSON.

## Explainer

### feature-explainer

- Feature explainer for research/learning output: sticky on-this-page nav, an
  overview TL;DR, prose sections, and labeled code blocks (tabs flattened to
  stacked blocks).
- Slots: `topic`, `overview`, `sections[]` (+ optional code blocks).
- Producer: general-purpose.
- Siblings: Markdown (default), JSON.

### concept-explainer

- Concept explainer for research/learning: an intuition lead, plain-prose
  mechanics, a worked example, and a further-reading sidebar.
- Slots: `concept`, `intuition`, `mechanics`, `example` (+ 3 optional).
- Producer: the `codebase-onboarding` skill's `explaining` fragment.
- Siblings: Markdown (default), JSON.

### code-understanding

- "How does X work" walkthrough: a question + summary header, a numbered
  call-sequence with collapsible source snippets, and a sidebar of key
  components and related references.
- Slots: `title`, `question`, `callSequence[]`, `components[]` (+ optional refs).
- Producer: the `codebase-onboarding` skill's `mapping` fragment and the `code-explorer` agent.
- Siblings: Markdown (default), JSON.

## Exploration

### code-approaches

- Exploration of multiple candidate implementations: a prompt/context header, a
  grid of approach cards (name, code sketch, pros/cons table), and a closing
  recommendation.
- Slots: `title`, `context`, `approaches[]`, `recommendation` (+ 2 optional).
- Producer: `code-architect` agent.
- Siblings: Markdown (default), JSON.

### visual-exploration

- Visual-exploration board: a context/prompt header above a grid of labeled
  artboards, each a static design-direction mockup with a rationale.
- Slots: `title`, `context`, `directions` (+ 1 optional).
- Producer: `ui-design` skill.
- Siblings: Markdown (default), JSON.

### design-system

- Design-system reference: color swatches, a type scale, a spacing ruler, and a
  core-component gallery rendered from shared tokens.
- Slots: `title`, `swatches`, `typeScale`, `spacing`, `components` (+ 1 optional).
- Producer: the `ui-design` skill's `design-systems` fragment.
- Siblings: JSON.

### component-variants

- Component variant matrix: one named component rendered in several structural
  variants, each cell labeling its state, prop combo, and a usage note.
- Slots: `title`, `component`, `variants` (+ 1 optional).
- Producer: design-only.
- Siblings: JSON.

## Report

### status-report

- Status report for a reporting period: highlights, in-progress work, blockers,
  steering metrics, and next-up items.
- Slots: `title`, `dateRange`, `highlights`, `inProgress` (+ 4 optional).
- Producer: design-only.
- Siblings: Markdown, JSON.

### incident-report

- Incident / postmortem report: header with severity and status, TL;DR, a dotted
  timeline, root-cause prose with an optional diff, an impact table, and owned
  action items.
- Slots: `id`, `title`, `severity`, `summary`, `timeline[]`, `rootCause`,
  `impact`, `followups[]` (+ 2 optional).
- Producer: design-only.
- Siblings: Markdown, JSON.

### triage-board

- Triage board: a toolbar count summary and filter chips above static kanban
  columns (Now / Next / Later / Cut) holding triaged ticket cards.
- Slots: `title`, `summary`, `columns` (+ 3 optional).
- Producer: design-only.
- Siblings: JSON.

### feature-flags

- Feature-flag config view: grouped flag panels showing each flag's on/off
  state, rollout percentage, and dependency, plus a sidebar with the pending
  config diff and unmet-requirement warnings.
- Slots: `title`, `flags` (+ 6 optional).
- Producer: design-only.
- Siblings: JSON.

### prompt-tuner

- Prompt tuner: an editable system prompt with `{{variable}}` slots, a sample
 input, a live-filled preview, and quality metrics. Carries the
  minimal-JS exception.
- Slots: `title`, `systemPrompt`, `input`, `previewOutput`, `variables[]`,
  `metrics[]` (+ 1 optional).
- Producer: design-only.
- Siblings: Markdown, JSON.

## Diagram

### flowchart

- Flowchart: a CSS-driven vertical node spine with kind-coded shapes (process,
  decision, terminal, ok, bad), labelled connectors, and a directed-edge
  adjacency list with legend.
- Slots: `title`, `nodes`, `edges` (+ 2 optional).
- Producer: general-purpose.
- Siblings: Markdown, JSON.

### svg-illustrations

- SVG illustration sheet: a header lead above a stack of inline-SVG figures, each
  on a bordered canvas with a caption. Palette-locked, no external assets.
- Slots: `title`, `illustrations` (+ 3 optional).
- Producer: design-only.
- Siblings: HTML only.

### prototype-animation

- Animation prototype: a replayable completion micro-interaction with an
  easing-curve switcher and the copy-paste CSS that drives it. Carries the
 minimal-JS exception.
- Slots: `title`, `stage`, `easings[]`, `cssSnippet` (+ 1 optional).
- Producer: design-only.
- Siblings: HTML only.

### prototype-interaction

- Interaction prototype: a throwaway interactive region (e.g. drag-to-reorder)
  plus the behaviour decisions baked in and the open questions to push back on.
 Carries the minimal-JS exception.
- Slots: `title`, `stage`, `behaviorNotes`, `openQuestions[]` (+ 1 optional).
- Producer: design-only.
- Siblings: Markdown.

## Deck

### slide-deck

- Slide deck rendered as print-friendly stacked slide cards: a title slide plus
  content slides with a heading, bullets, and an optional speaker note. No
  navigation scripting.
- Slots: `title`, `slides` (+ 3 optional).
- Producer: design-only.
- Siblings: Markdown, JSON.
