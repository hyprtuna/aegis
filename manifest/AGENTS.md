# manifest — Agent Guidance

## Purpose

`manifest/` is the machine-readable contract for Aegis's surface tree.

- `aegis.manifest.json` declares canonical surfaces, supported hosts, output formats, and the approved guidance-folder list.
- `schemas/aegis-surface.schema.json` is the JSON Schema for canonical frontmatter (lean 5-field + `x-<adapter>` extension namespace).

## Rules

- This folder is the source of truth for what surfaces exist. If you add a new canonical surface, update `aegis.manifest.json` AND `scripts/validate-structure.mjs` in the same change.
- The schema's `additionalProperties: true` is intentional — it accepts host- or source-specific metadata under `x-<namespace>`. Do not invent new unscoped top-level keys.
- Do not put canonical content here. This folder holds metadata only.

## Model Alias Conventions

`models.json`'s `codex` and `opencode` columns deliberately **mirror each other** for every alias (including `fable`), each carrying the Claude model id with an `anthropic/` provider prefix (e.g. `anthropic/claude-fable-5`); the `claude` column carries the unprefixed Claude-native id (e.g. `claude-fable-5`) — the columns are not meant to string-equal each other. `scripts/project.mjs` only ever resolves the Claude-native id, and Codex has no per-agent model-override surface to diverge onto, so there is nothing for the `codex`/`opencode` columns to differ by across aliases — they stay per-alias identical to each other up to the `anthropic/` prefix. Future audits should NOT re-flag `fable.codex` (or any alias's `codex`/`opencode` entry) as a copy-paste bug. This note lives here rather than in `models.json` itself to avoid an invalid `//` comment and keep the change docs-only (no `manifest/` surface edit).

**`fable`-tier cost caveat:** the `fable` tier is a premium tier (materially costlier than Opus) — do not tag it on the `code-reviewer --strict` family or other high-volume review paths.

**`CLAUDE_CODE_SUBAGENT_MODEL` honest gap.** An org- or user-level `CLAUDE_CODE_SUBAGENT_MODEL` env var can override the per-agent `model` Aegis projects from `manifest/permissions.json` at runtime — Aegis has no control over it and cannot detect it from inside the projector. Precedence is env var > projected frontmatter; document this so operators aren't surprised when an agent runs on a different model than its generated `adapters/claude/agents/<name>.md` declares.
