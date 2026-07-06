# Q1/Q2 AskUserQuestion Payloads

On-demand payloads for the spec location (Q1) and format (Q2) questions. Parent `SKILL.md` covers the prompt-override flow and when to skip these.

## Q1 — Location

Invoke AskUserQuestion with the following payload:

```json
{
  "question": "Where should the spec be stored?",
  "intro": "Choose where to write the spec. Storing under .aegis/specs/ integrates with implementation-planner tooling. Location and format are independent — you will be asked about format next.",
  "options": [
    {
      "label": ".aegis/specs/features/<slug>/spec.md (Recommended)",
      "description": "In-project specs directory; created if missing. Enables the brainstorm-spec → implementation-planner chain and decision coverage checks."
    },
    {
      "label": "docs/specs/<slug>.md",
      "description": "In-project public-shaped docs. Use when you want the spec visible in published documentation."
    },
    {
      "label": "~/.aegis/projects/<auto-name>/specs/<slug>.md",
      "description": "Out-of-project; keeps your project repo clean of generated artifacts. Only shown when ~/.aegis/ exists."
    },
    {
      "label": "Custom path",
      "description": "Relative path you provide. Must not contain \"..\" or escape the project root."
    }
  ],
  "_rationale": "Integrates with implementation-planner and plan-verifier; the directory is bootstrapped on first use."
}
```

Note: only show the `~/.aegis/projects/` option when `~/.aegis/` exists on the system.

After the user picks: bootstrap the chosen directory silently if missing (`mkdir -p`); for custom paths, validate the path is relative, has no `..` segments, and does not escape the project root. The structured-spec path additionally triggers the SDD layout — see `abilities/structured-spec-extras.md` for details.

## Q2 — Format

Invoke AskUserQuestion with the following payload:

```json
{
  "question": "What format should the spec use?",
  "intro": "Structured-spec adds decisions grammar (decisions block + numbered IDs) required by implementation-planner. Markdown is a human-readable spec without tooling dependencies.",
  "options": [
    {
      "label": "Structured-spec (decisions block + numbered decision IDs) (Recommended)",
      "description": "Adds a structured decisions block with numbered IDs and YAML frontmatter required by implementation-planner and plan-verifier decision coverage checks."
    },
    {
      "label": "Markdown",
      "description": "Plain markdown spec without structured decision grammar; best when implementation-planner is not part of the workflow."
    },
    {
      "label": "Both",
      "description": "Write both a structured-spec and a plain markdown version at the chosen location; use when both tooling and human audiences matter."
    }
  ],
  "_rationale": "Structured-spec enables decision coverage checks; markdown serves human readers and projects not using plan tooling."
}
```
