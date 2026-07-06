---
kind: command
name: skill-unpin
description: Unpin a skill from your slash menu shortcuts
visibility: user
platforms: [claude, opencode, codex, cursor, zed]
x-claude:
  argument-hint: "<name>"
---

Remove a skill from your per-user pin list (`~/.aegis/pins.json`).
