---
name: rust-developer
description: 'Use when Rust development, testing, review, security, or code-practice guidance is needed.'
paths: ['**/*.rs']
---

# Rust Developer

Coordinate Rust work through migrated Aegis abilities and rule overlays.

## Activation

This overlay activates on the shared matcher table `**/*.rs` — the same glob the
`file-changed` hook (`hooks/file-changed.json` `trigger.paths`) watches, so
`paths:`-based skill activation and the FileChanged lint/format reminder fire on one
set.

## Abilities
- `abilities/rust-development.md`
- `abilities/rust-testing.md`

## Rule Overlays
- `rules/coding-style.md`
- `rules/patterns.md`
- `rules/security.md`
- `rules/testing.md`

Load only the ability or rule needed for the current request unless the user asks for a complete Rust workflow.
