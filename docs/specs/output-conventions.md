# Output Conventions

Aegis workflows produce three output formats:

## Markdown

Default for human-readable artifacts: plans, specs, research notes, code reviews, audits. Stored in repo as `.md`.

## JSON

For machine-readable: routing decisions, audit results, validation output, inventory. Schemas live at `manifest/schemas/`. Use schema-validated JSON whenever the artifact is consumed by another script or agent.

## Standalone HTML

For stakeholder-facing deliverables that benefit from layout, hierarchy, and visual coding.

**Constraints:**
- Self-contained: no external `src=`, `href=`, `@import`, or CDN refs.
- All CSS inline in a `<style>` block.
- System font stacks only (`ui-serif`, `system-ui`, `ui-monospace`).
- Static documents have 0–1 `<script>` tags; interactive editors may have more.
- File size target: ~10–25 KB.
- Use templates with content slots — agents fill slots, not full HTML.
- Accessible: semantic landmarks/sectioning, WCAG AA contrast, keyboard-reachable
  interactive controls (the three interactive templates: `prototype-animation`,
  `prototype-interaction`, `prompt-tuner`), and `aria-hidden` on purely-decorative
  SVG. See the `ui-design` skill for the full a11y guidance.

**v0.0.1 templates (3):**
- `templates/html/implementation-plan.html`
- `templates/html/code-review.html`
- `templates/html/status-report.html`

**v0.1.0 target (full coverage):** plan, code-review, status, incident, PR-writeup, research, exploration, code-understanding, design-system, component-variants, animation, slide-deck, illustrations, flowchart, feature-explainer, concept-explainer, triage-board, feature-flags, prompt-tuner.

Coverage tracked in `.aegis/index/html-templates.md`.

## When to Choose Each

| Output | Use when |
|---|---|
| Markdown | Default. Agent-to-agent or repo-archived content. |
| JSON | Output consumed by tooling, scripts, or schema validation. |
| HTML | Single-read human deliverable that benefits from visual structure. |

**Anti-pattern:** Don't use HTML for ephemeral agent-to-agent passes — markdown is cheaper and easier to diff/edit.
