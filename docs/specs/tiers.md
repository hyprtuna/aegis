# Tiers

Aegis tiers describe visibility, not product editions.

- **`core`** — always safe to expose. Listed in skill discovery on every host.
- **`specialist`** — visible when relevant to the detected project, language, or user request. Filtered by frontmatter `paths:` or host-side heuristics.
- **`internal`** — loaded only by a parent skill, agent, hook, or command. Not directly user-invocable; not listed in skill discovery.
- **`adapter`** — host-native projection detail. Owned by `adapters/<host>/` or generated host files; never appears in skill listings.

## Mapping to Frontmatter

```yaml
visibility: user      # core or specialist; appears in /skills
visibility: internal  # not listed; loaded by reference only
```

The `adapter` tier doesn't appear in canonical frontmatter — it's a property of files generated into host-native paths (e.g. `.cursor/rules/*.mdc`).

## Abilities and Tier

Abilities are markdown fragments owned by a parent skill. They are NOT registered, so they have no tier — only their parent skill has a tier. Abilities load on demand when the parent skill's body references them.
