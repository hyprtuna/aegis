---
name: aegis-skill
description: 'Activate a named skill explicitly. Bypasses skill-selection; use when you know exactly which skill you want.'
---

Invoke the named skill directly.

Bypasses skill-selection routing; useful when you already know which skill you want.

Accepts a bare `<slug>` or qualified `<pack>:<slug>`. The bundled namespace is `aegis`, so `aegis:code-review` is equivalent to bare `code-review` when no third-party pack collides on the same slug.

## Procedure

1. Parse `$ARGUMENTS` as the skill identifier.
2. Resolve to a fully-qualified slug (`aegis:<slug>` if no pack prefix).
3. Load the skill via the host's native skill mechanism (Claude: `Skill({skill: "<qualified>"})`, OpenCode: `/<slug>` or `skill` tool).
4. Execute the skill body in the current session.

## When to Use

- The skill name is already known and routing is wasteful.
- A user wants to pin a specific skill regardless of intent detection.
- Debugging skill resolution (compare bare vs qualified).
