# Q1/Q2 AskUserQuestion Payloads

On-demand payloads for the location (Q1) and format (Q2) questions, plus post-pick handling. Parent `SKILL.md` covers the prompt-override flow, preference check, and when to skip these.

## Q1 — Location

Invoke AskUserQuestion with the following payload:

```json
{
  "question": "Where should the plan be stored?",
  "intro": "Choose where to write the plan. Location and format are independent — you will be asked about format next.",
  "options": [
    {
      "label": ".aegis/plans/<version>.plan.md (Recommended)",
      "description": "In-project plans directory; created if missing. Integrates with plan validation and execution commands."
    },
    {
      "label": "docs/plans/<slug>.md",
      "description": "In-project public-shaped docs. Use when you want the plan in your published documentation."
    },
    {
      "label": "~/.aegis/projects/<auto-name>/plans/<slug>.plan.md",
      "description": "Out-of-project; keeps your project repo clean of generated artifacts. Only shown when ~/.aegis/ exists."
    },
    {
      "label": "Custom path",
      "description": "Relative path you provide. Must not contain \"..\" or escape the project root."
    }
  ],
  "_rationale": "Integrates with plan validation, plan execution, and the dependency graph; the directory is bootstrapped on first use."
}
```

Note: only show the `~/.aegis/projects/` option when `~/.aegis/` exists on the system.

After the user picks:

- In-project plans directory → bootstrap the directory silently if missing (`mkdir -p`).
- `docs/plans/` → no directory creation needed.
- `~/.aegis/projects/` → use the out-of-project path as-is.
- Custom path → validate: must be relative, no `..` segments, no cwd escape. Surface a clear error and re-prompt if invalid.

## Q2 — Format

Invoke AskUserQuestion with the following payload:

```json
{
  "question": "What format should the plan use?",
  "intro": "Structured-slate integrates with plan validation and execution tooling. Markdown is human-readable for review and discussion. Both writes two files at the chosen location.",
  "options": [
    {
      "label": "Structured slate (frontmatter + markdown body) (Recommended)",
      "description": "YAML frontmatter (executable_plan, must_haves, covered_decisions) + markdown body; consumable by plan-validate and plan-run tooling."
    },
    {
      "label": "Markdown",
      "description": "Plain markdown plan with phases and acceptance criteria; no structured frontmatter; best for human review and discussion."
    },
    {
      "label": "Both",
      "description": "Write both a structured-slate and a plain markdown file at the chosen location; use when both tooling and human audiences matter."
    }
  ],
  "_rationale": "Structured-slate enables plan validation and execution via tooling; markdown serves human readers reviewing in PRs."
}
```
