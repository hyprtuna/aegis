# HTML templates

Self-contained, standalone HTML output skeletons — one file per output kind,
flat layout (`templates/html/<name>.html`) with a sibling `<name>.template.json`
slot manifest. These are the stakeholder-deliverable family: open them in a
browser, no build step, no external `src`/`href`/CDN.

Reference-gallery coverage is the full `references/html-effectiveness/` gallery —
**20/20** as of v0.0.8. v0.0.9 adds two further producer-backed kinds outside the
gallery (`plan-audit-report`, `research-report`). See `../../docs/templates.md` for
the authoring guide, the per-kind format index (`manifest/template-index.json`), and
the `${TEMPLATE:<kind>:<format>}` resolver. Coverage history lives in
`.aegis/index/html-templates.md`.

## Shipping children

| Template | Kind | Notes |
|---|---|---|
| `code-approaches.html` | code-approaches | Side-by-side implementation approaches. |
| `code-review.html` | code-review | Severity-graded review writeup. |
| `code-understanding.html` | code-understanding | Codebase walkthrough. |
| `component-variants.html` | component-variants | Component state/prop matrix. |
| `concept-explainer.html` | concept-explainer | Concept explainer. |
| `design-system.html` | design-system | Design-system reference. |
| `feature-explainer.html` | feature-explainer | Feature explainer. |
| `feature-flags.html` | feature-flags | Feature-flag config view. |
| `flowchart.html` | flowchart | Flowchart / pipeline diagram. |
| `implementation-plan.html` | implementation-plan | Phased implementation plan. |
| `incident-report.html` | incident-report | Incident report / postmortem. |
| `plan-audit-report.html` | plan-audit-report | Plan verification report. |
| `pr-writeup.html` | pr-writeup | Pull-request writeup. |
| `research-report.html` | research-report | Research findings / options / recommendation. |
| `prompt-tuner.html` | prompt-tuner | Prompt-tuning workbench (interactive — minimal JS). |
| `prototype-animation.html` | prototype-animation | Animation/easing prototype (interactive — minimal JS). |
| `prototype-interaction.html` | prototype-interaction | Interaction prototype (interactive — minimal JS). |
| `slide-deck.html` | slide-deck | Print-friendly slide deck. |
| `status-report.html` | status-report | Status report. |
| `svg-illustrations.html` | svg-illustrations | Captioned inline-SVG illustrations. |
| `triage-board.html` | triage-board | Kanban triage board. |
| `visual-exploration.html` | visual-exploration | Visual design exploration. |

**Interactive exception:** `prototype-animation`,
`prototype-interaction`, and `prompt-tuner` are the only templates permitted
self-contained JavaScript — JS drives the demo behavior only, with no external
`src`/CDN, no network, no tracking. All other HTML templates stay zero-JS.
