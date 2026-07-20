# manifest — Agent Guidance

## Purpose

`manifest/` is the machine-readable contract for Aegis's surface tree.

- `aegis.manifest.json` declares canonical surfaces, supported hosts, output formats, and the approved guidance-folder list.
- `schemas/aegis-surface.schema.json` is the JSON Schema for canonical frontmatter (lean 4-field + `x-<adapter>` extension namespace). `kind` is retired and the schema now asserts its ABSENCE (`"not": {"required": ["kind"]}`); the `FRONTMATTER` validator rejects it too. `kind` survives only as a discriminator in the JSON contracts that genuinely validate it — `hooks/*.json`, `statuslines/**/statusline.json`, and `templates/**/*.template.json`.

## Rules

- This folder is the source of truth for what surfaces exist. If you add a new canonical surface, update `aegis.manifest.json` AND `scripts/validate-structure.mjs` in the same change.
- The schema's `additionalProperties: true` is intentional — it accepts host- or source-specific metadata under `x-<namespace>`. Do not invent new unscoped top-level keys.
- Do not put canonical content here. This folder holds metadata only.

## Model Intent Tiers

An agent declares **what kind of work it needs**, not a vendor model family. `manifest/permissions.json` carries the tier; `models.json` resolves it:

| Tier | Intent | Claude |
|---|---|---|
| `deep` | heavy reasoning — planning, strict review, architecture | `claude-opus-4-8` |
| `balanced` | default implementation work | `claude-sonnet-4-6` |
| `fast` | cheap, low-latency mechanical work | `claude-haiku-4-5` |
| `inherit` | defer entirely to the host/user | (omits `model:`) |

The retired Anthropic-family names (`opus`/`sonnet`/`haiku`, plus `best`/`default` and the full model IDs) still **resolve** through `aliasOf` for back-compat, but they are not **declarable** tiers — `scripts/lib/validate-permissions.mjs` accepts only `deep`/`balanced`/`fast` in `permissions.json`. Same status `best` has always had. `unknownAliasPolicy: hard-fail` is preserved, so a typo stays loud.

**Per-host model IDs have been removed.** `models.json` previously declared `opencode` and `codex` IDs (`anthropic/claude-*`) alongside `claude`. Nothing read them: `resolveClaudeModel()` (`scripts/project.mjs`) and `resolveClaudeModelId()` (`scripts/lib/validate-permissions.mjs`) are the only consumers that dereference the alias map, and both read `.claude` exclusively; `scripts/validate/capabilities.mjs` only parses the file for validity. Meanwhile the Codex skill projector emits `name` + `description` only and the OpenCode plugin emits no `model:` at all — so no `anthropic/*` string ever reached a generated artifact. The declaration nonetheless *read* as behaviour, implying Aegis pins OpenCode and Codex users to Anthropic models. It did not, and now it does not say so either. A regression test in `scripts/test-projection.mjs` pins the claim so it is not re-derived. OpenCode and Codex model selection is a documented gap in `manifest/capabilities.json`, not a silent drop.

**`fable` is resolvable, not declarable.** `fable` names one specific premium Claude model rather than a capability intent, so it has no tier slot. It stays in `aliases` (a canonical `model: fable` still resolves to `claude-fable-5`) but is excluded from the declarable set, so no agent can be pinned to it through `permissions.json`. Cost caveat, retained: `fable` is materially costlier than Opus — do not tag it on the `code-reviewer --strict` family or other high-volume review paths.

**`CLAUDE_CODE_SUBAGENT_MODEL` honest gap.** An org- or user-level `CLAUDE_CODE_SUBAGENT_MODEL` env var can override the per-agent `model` Aegis projects from `manifest/permissions.json` at runtime — Aegis has no control over it and cannot detect it from inside the projector. Precedence is env var > projected frontmatter; document this so operators aren't surprised when an agent runs on a different model than its generated `adapters/claude/agents/<name>.md` declares.
