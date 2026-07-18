# JSON templates

Data-shaped output skeletons, nested by **family folder**
(`templates/json/<family>/<variant>.json`) with a sibling
`<variant>.template.json` slot manifest. Slots are literal placeholder strings
that keep the file parseable JSON (see `../../docs/templates.md` for the exact
marker syntax). These are the machine-readable siblings of the deliverable kinds
plus the AskUserQuestion decision payloads.

See `../../docs/templates.md` for the authoring guide and the per-kind format
index (`manifest/template-index.json`).

## Shipping children (family folders)

| Family | Variant | What it is |
|---|---|---|
| `decisions` | claude-code | AskUserQuestion decision payload. |
| `code-approaches` | default | Approaches as structured data. |
| `code-review` | default | Machine-consumed review findings. |
| `code-understanding` | default | Walkthrough graph. |
| `component-variants` | default | Variant matrix data. |
| `concept-explainer` | default | Concept data. |
| `design-system` | default | Design tokens. |
| `feature-explainer` | default | Feature data. |
| `feature-flags` | default | Flag config. |
| `flowchart` | default | Nodes / edges graph. |
| `implementation-plan` | default | Task graph. |
| `incident-report` | default | Timeline / metrics. |
| `plan-audit-report` | default | PlanAuditReport data (verdict, gaps, coverage counts). |
| `research-report` | default | Research findings / options / recommendation summary. |
| `slide-deck` | default | Slide metadata. |
| `status-report` | default | Metrics / tasks. |
| `triage-board` | default | Issue / column data. |
| `visual-exploration` | default | Exploration data. |
| `prompt-tuner` | default | Prompt config. |
