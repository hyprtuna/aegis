---
name: skill-extraction
description: Use when a session became a repeatable workflow — decide whether it is worth a skill, then hand off to skill-creation.
visibility: user
platforms: [claude, opencode, codex, cursor, zed]
x-aegis:
  pipeline:
    next: skill-creation
x-claude:
  primitiveHint: skill
---

# Skill Extractor

Recognize when the current session encoded a reusable, non-obvious workflow, run the candidate through a hard quality gate, and — only if it passes — hand a distilled heuristic-level draft to `skill-creation`. Guiding principle: **skills encode decision-making heuristics, not snippets.**

## When This Triggers

- A multi-step workflow just worked and would plausibly recur.
- A non-obvious sequence was discovered by trial and error, not read from docs.
- The agent had to reason out a decision procedure (when to do X vs Y) rather than follow one.
- The session accumulated project-specific context that would otherwise be re-derived next time.

## Quality Gate

Extract ONLY if Q1 is *no* and Q2 and Q3 are both *yes*. Any disqualifying answer: state "not skill-worthy — do not extract" and stop. No soft "consider anyway" clause.

1. **Googleable in 5 minutes?** If someone could find this by a quick search, it is not skill-worthy. (Fail → stop.)
2. **Codebase / project-specific?** Does it encode knowledge particular to this project, its conventions, or its tooling — not generic advice? (Must be yes.)
3. **Did it take real effort?** Was it earned through non-trivial reasoning, dead ends, or accumulated context — not a one-liner? (Must be yes.)

## What to Extract

Capture the *decision procedure* — when to do X vs Y, what to check, what tradeoff was resolved — not verbatim commands or code blocks. A command may illustrate the decision; it is never the substance. If what remains after removing commands is empty, the candidate was a snippet, not a skill — fails the gate retroactively.

## Handoff to skill-creation

Assemble the candidate's `name` (kebab-case verb-noun), one-line trigger-style `description`, target family (`core/`, `languages/<lang>-developer/`, `workflows/`), and the distilled heuristic body, then invoke `skill-creation` to scaffold and validate. Do not write frontmatter or run the static gate here — `skill-creation` owns that; see `skills/core/skill-creation/SKILL.md`.

## Common Mistakes

- Extracting a snippet instead of a heuristic.
- Extracting something Googleable (fails Q1).
- Duplicating `skill-creation`'s scaffold or frontmatter logic instead of handing off.
- Extracting generic, non-project advice (fails Q2).
