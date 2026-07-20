# Contributing to Aegis

## Repository Layout

Aegis is plugin-first. Content lives in canonical surface folders at the repo root. Host-native files live where each host expects them. There is **no** user CLI and **no** mandatory build step for users.

## Setup (Maintainers Only)

```bash
git clone <repo>
cd aegis
# No install needed for content work.
# For validation:
node scripts/validate-structure.mjs
node scripts/inventory.mjs
```

Validation requires Node 20+ only. No Bun, no TypeScript, no npm install for users.

## Workflow

1. Pick a task from `.aegis/plans/v0.0.x-plan.md` (the highest x with incomplete checkboxes).
2. Read the relevant feature spec at `.aegis/specs/features/ag-NNNN-*/`.
3. Implement in canonical paths.
4. Run validation:
   ```bash
   node scripts/validate-structure.mjs
   ```
5. Tick the checkbox in the release plan.
6. Open a PR. (No PR template required for v0.0.x.)

## Naming Conventions

- Skills: `skills/<scope>/<kebab-name>/SKILL.md`. Scope ∈ `core`, `languages`, `workflows`.
- Abilities: `skills/<scope>/<name>/abilities/<ability>.md`. Plain markdown, optional minimal frontmatter.
- Agents: `agents/<kebab-name>.md`.
- Commands: `commands/<kebab-name>.md`.
- Rules: `rules/<kebab-name>.md` (universal); `skills/core/develop/abilities/languages/<lang>/rules/{coding-style,patterns,security,testing}.md` (per-language).
- Templates: `templates/{markdown,json,html,prompts}/<domain>/<name>.md`.

## Frontmatter

Lean 4-field canonical:

```yaml
---
name: stable-kebab-slug
description: One-line, trigger-like.
visibility: user | internal
platforms: [claude, opencode, codex, cursor, zed]
source: anvil:<original-path>     # migrated content only
---
```

Adapter-specific metadata uses `x-<adapter>` namespace (`x-claude:`, `x-opencode:`, etc.).

## Sparse Guidance Rule

`AGENTS.md` + `CLAUDE.md` exist ONLY at the repo root and at each main surface folder root. Nested folders inherit. `scripts/validate-structure.mjs` enforces this.

## What NOT to Add

- A user-facing CLI binary.
- Bun, TypeScript runtime, or compile steps for users.
- Skills that duplicate existing skills (search first).
- Anvil-branded addenda (`*-anvil-addendum.md` is a port artifact, not a new pattern).
- Content inside `adapters/<host>/` (only projection notes belong there).
- More than 15 slash commands without a roadmap-level discussion.

## License

MIT.
