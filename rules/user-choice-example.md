---
kind: rule
name: user-choice-example
description: Use when verifying the two-question user-choice pattern in E2E tests — demonstrates conformant Q1 (location) and Q2 (format) AskUserQuestion payload shapes. NOT a shipping skill.
visibility: user
platforms: [claude, opencode, codex, cursor, zed]
---

# user-choice-example

> **Non-invocable demo — not a shipping rule/skill.** This file is an E2E payload-shape fixture: it demonstrates the conformant Q1 (location) + Q2 (format) `AskUserQuestion` shapes that `user-choice-discipline` mandates. It is documentation-by-example, not an invocable surface. Do not route work to it; do not treat it as a rule that governs behaviour. The governing rule is `rules/user-choice-discipline.md`.

**Announce:** I'm using the user-choice-example skill to demonstrate the two-question pattern (location + format) for storing a code-review writeup.

## Status

Starting the two-question user-choice prompt.

## Q1 — Location choice

Where should the code-review writeup be stored? Location and format are independent choices.

I will present the first `AskUserQuestion` payload to the user now:

```json
{
  "question": "Where should the code-review writeup be stored?",
  "intro": "Storing under .aegis/reviews/ integrates with Aegis tooling (search, cross-linking, structured frontmatter). Storing under docs/reviews/ keeps the artifact in your repo's public docs. Out-of-project storage keeps your repo clean. A custom path gives you full control.",
  "options": [
    {
      "label": ".aegis/reviews/ (Recommended)",
      "description": "In-project Aegis tree; created if missing. Integrates with Aegis tooling — search, cross-linking, structured frontmatter."
    },
    {
      "label": "docs/reviews/",
      "description": "In-project public-shaped docs. Use when you want the artifact in your repo's published docs."
    },
    {
      "label": "~/.aegis/projects/<auto-name>/reviews/",
      "description": "Out-of-project; keeps your project repo clean of generated artifacts. Only shown when ~/.aegis/ exists."
    },
    {
      "label": "Other (custom path)",
      "description": "Provide a relative path. Must not contain \"..\" or escape the project root."
    }
  ],
  "_rationale": "Picks up structured frontmatter and Aegis cross-linking; the directory is bootstrapped on first use."
}
```

## Q2 — Format choice

What format should the code-review writeup use? Format is independent of location.

The option set is **index-driven**: the `code-review` kind declares `formats: { markdown, html }` in
`manifest/template-index.json` with `default: markdown`, so Q2 offers exactly Markdown and HTML —
including the HTML stakeholder deliverable — with Markdown (the default) marked Recommended. A kind
that also shipped JSON would surface a JSON option here too; a kind that shipped only HTML would
surface HTML alone.

I will present the second `AskUserQuestion` payload to the user now:

```json
{
  "question": "What format should the code-review writeup use?",
  "intro": "Choose based on who will read the artifact. The options below are the formats the code-review kind ships per manifest/template-index.json. Format is independent of where the file is stored.",
  "options": [
    {
      "label": "Markdown (Recommended)",
      "description": "Human-readable narrative; renders in PR diffs and on GitHub. The code-review kind's default format."
    },
    {
      "label": "HTML",
      "description": "Standalone stakeholder deliverable — severity-graded findings and reviewer sign-off as a self-contained page. Best when sharing outside the diff."
    }
  ],
  "_rationale": "Markdown is the default and serves PR/GitHub readers; HTML produces a shareable standalone artifact. Both come straight from the kind's index entry — no hardcoded format list."
}
```

After the user selects location and format:
- `.aegis/reviews/` → `mkdir -p`; load Aegis-flavored output addendum if present.
- `docs/reviews/` or custom path → use generic skill body verbatim; validate path (relative, no `..`, no cwd escape).
- Resolve the chosen format via `${TEMPLATE:code-review:<format>}` and write it: Markdown → `<name>.md` (from `${TEMPLATE:code-review:markdown}`); HTML → `<name>.html` (from `${TEMPLATE:code-review:html}`). If more than one format is chosen, write one file per format.

## Done — status: DONE
