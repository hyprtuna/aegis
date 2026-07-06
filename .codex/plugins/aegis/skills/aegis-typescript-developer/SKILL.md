---
name: aegis-typescript-developer
description: 'Use when TypeScript development, testing, review, security, or code-practice guidance is needed.'
---

# TypeScript Developer

Coordinate TypeScript work through migrated Aegis abilities and rule overlays.

## Activation

This overlay activates on the shared matcher table `**/*.ts`, `**/*.tsx` — the same
globs the `file-changed` hook (`hooks/file-changed.json` `trigger.paths`) watches, so
`paths:`-based skill activation and the FileChanged lint/format reminder fire on one
set.

## Abilities
- `abilities/typescript-development.md`
- `abilities/typescript-typing.md`

## Rule Overlays
- `rules/coding-style.md`
- `rules/patterns.md`
- `rules/security.md`
- `rules/testing.md`

Load only the ability or rule needed for the current request unless the user asks for a complete TypeScript workflow.
