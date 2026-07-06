# rules — Agent Guidance

## Purpose

`rules/` holds universal always-loaded iron-law guidance. Short, imperative directives that govern agent behavior across every workflow.

## Layout

```
rules/<rule-name>.md
```

Flat. Per-language rules live with the language skill (`skills/languages/<lang>-developer/rules/`).

## Frontmatter

```yaml
---
kind: rule
name: stable-kebab-slug
description: One-line directive.
visibility: user
platforms: [claude, opencode, codex, cursor, zed]
---
```

## What Belongs Here

Iron laws (ported from Anvil): `tdd-iron-law`, `evidence-before-assertion`, `verification-before-completion`, `rationalization-prevention`, `agentic-engineering`, `coding-standards`, `context-budget`, `decision-template-discipline`, `one-percent-rule`, `orchestrator-first`, `user-choice-discipline`, `templates`, `skeptical-stance`.

## What Does NOT Belong Here

- Per-language rules (those live in `skills/languages/<lang>/rules/`).
- Long explanations or full skill bodies.
- Adapter-specific guidance (use `x-<adapter>:` if absolutely necessary).
