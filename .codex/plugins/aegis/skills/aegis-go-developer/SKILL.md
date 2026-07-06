---
name: aegis-go-developer
description: 'Use when Go development, testing, review, security, or code-practice guidance is needed.'
---

# Go Developer

Coordinate Go work through migrated Aegis abilities and rule overlays.

## Activation

This overlay activates on the shared matcher table `**/*.go` — the same glob the
`file-changed` hook (`hooks/file-changed.json` `trigger.paths`) watches, so
`paths:`-based skill activation and the FileChanged lint/format reminder fire on one
set.

## Abilities
- `abilities/go-development.md`
- `abilities/go-testing.md`

## Rule Overlays
- `rules/coding-style.md`
- `rules/patterns.md`
- `rules/security.md`
- `rules/testing.md`

Load only the ability or rule needed for the current request unless the user asks for a complete Go workflow.
