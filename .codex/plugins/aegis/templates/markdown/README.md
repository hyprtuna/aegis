# Markdown templates

Prose / doc-shaped output skeletons, nested by **family folder**
(`templates/markdown/<family>/<variant>.md`) with a sibling
`<variant>.template.json` slot manifest. Variants are typically `default`, with
an optional terser `minimal`. Slots use mustache-lite markers in the body; the
agent renders arrays to text before substitution. See `../../docs/templates.md`
for the exact slot syntax.

These cover both the planning families (plans, specs, decisions, …) and the
Markdown siblings of the multi-format deliverable kinds. See
`../../docs/templates.md` for the authoring guide and the per-kind format index
(`manifest/template-index.json`).

## Shipping children (family folders)

| Family | Variants | What it is |
|---|---|---|
| `plans` | default, minimal | Implementation/release plan skeleton. |
| `specs` | default, minimal | Feature spec skeleton. |
| `decisions` | default, opencode | Four-part decision record (D-NN). |
| `changelogs` | default | Keep-a-Changelog release notes. |
| `tickets` | default | Work-ticket skeleton. |
| `releases` | default | Release checklist / cut. |
| `prompts` | default | One-shot agent-prompt skeleton. |
| `project` | agents-md, claude-md, tasks | Project scaffolding docs. |
| `code-approaches` | default | Side-by-side approaches. |
| `code-review` | default | Inline code-review writeup. |
| `code-understanding` | default | Codebase walkthrough notes. |
| `feature-explainer` | default | Feature explainer. |
| `concept-explainer` | default | Concept explainer. |
| `flowchart` | default | Flowchart (mermaid / ASCII). |
| `implementation-plan` | default | Implementation working doc. |
| `incident-report` | default | Incident postmortem. |
| `plan-audit-report` | default | Plan verification report. |
| `pr-writeup` | default | PR description. |
| `research-report` | default | Research findings, options, recommendation. |
| `slide-deck` | default | Slide-deck outline. |
| `status-report` | default | Status update. |
| `visual-exploration` | default | Visual exploration notes. |
| `prototype-interaction` | default | Interaction behavior notes. |
| `prompt-tuner` | default | Prompt + legend. |
