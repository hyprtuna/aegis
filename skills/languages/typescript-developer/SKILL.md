---
name: typescript-developer
description: Use when TypeScript development, testing, review, security, or code-practice guidance is needed.
visibility: user
platforms: [claude, opencode, codex, cursor, zed]
x-claude:
  paths: ["**/*.ts", "**/*.tsx"]
---

# TypeScript Developer

Coordinate TypeScript work through migrated Aegis abilities and rule overlays.

## Activation

This overlay activates on the shared matcher table `**/*.ts`, `**/*.tsx` via
`paths:`-based skill activation.

## Abilities
- `abilities/typescript-development.md`
- `abilities/typescript-typing.md`

## Rule Overlays
- `rules/coding-style.md`
- `rules/patterns.md`
- `rules/security.md`
- `rules/testing.md`

Load only the ability or rule needed for the current request unless the user asks for a complete TypeScript workflow.
