---
kind: skill
name: python-developer
description: Use when Python development, testing, review, security, or code-practice guidance is needed.
visibility: user
platforms: [claude, opencode, codex, cursor, zed]
x-claude:
  paths: ["**/*.py", "pyproject.toml", "requirements*.txt", "setup.py"]
---

# Python Developer

Coordinate Python work through migrated Aegis abilities and rule overlays.

## Activation

This overlay activates on the shared matcher table `**/*.py` (plus the project
markers in `x-claude.paths`) — `**/*.py` is the same glob the `file-changed` hook
(`hooks/file-changed.json` `trigger.paths`) watches, so `paths:`-based skill
activation and the FileChanged lint/format reminder fire on one set.

## Abilities
- `abilities/python-development.md`
- `abilities/python-testing.md`

## Rule Overlays
- `rules/coding-style.md`
- `rules/patterns.md`
- `rules/security.md`
- `rules/testing.md`

Load only the ability or rule needed for the current request unless the user asks for a complete Python workflow.
