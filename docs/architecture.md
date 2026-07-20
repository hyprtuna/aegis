# Aegis Architecture

Aegis is a CLI-free, plugin-first agentic AI development system. One canonical content tree projects natively into Claude Code, OpenCode, Codex, Cursor, and Zed.

## Core Principle

Aegis has **one canonical source tree** and **many host-native projections**. Canonical content lives at the repo root in stable folders (`skills/`, `agents/`, `commands/`, `rules/`, `templates/`). Hosts read from their native locations at the repo root (`.claude-plugin/`, `.opencode/`, `.cursor/`, `.rules`, `AGENTS.md`). `adapters/<host>/` documents projection decisions and gaps — it never holds duplicated content.

## Canonical Surfaces

| Surface | Path | Purpose |
|---|---|---|
| Skills | `skills/<scope>/<name>/SKILL.md` | Reusable capabilities. Scope: `core`, `languages`, `workflows`. |
| Abilities | `skills/<name>/abilities/<ability>.md` | On-demand fragments owned by a parent skill. NOT registered. |
| Agents | `agents/<name>.md` | First-class doers — subagents that complete bounded tasks. |
| Commands | `commands/<name>.md` | Slash-command workflow entry-points (capped ~15). |
| Rules | `rules/<name>.md` | Always-loaded iron-law guidance. |
| Hooks | `hooks/<event>.md` | Portable hook intents; per-host implementations in `.<host>-plugin/`. |
| Templates | `templates/` | Markdown, JSON, and standalone HTML output skeletons. |
| Adapters | `adapters/<host>/projection.md` | Projection notes + gap docs. |
| Manifest | `manifest/aegis.manifest.json` + `schemas/` | Machine-readable contract. |

## Capability Surface Selection

These surfaces are not interchangeable. Each capability belongs in the narrowest
surface that preserves correctness and keeps token cost down. When adding a
capability, walk this tree top to bottom and stop at the first match:

1. **Deterministic, always-on constraint tied to a path or event, no model
   judgment?** → `rule` (`rules/<name>.md`).
2. **Workflow, playbook, or advisory layer that should load only when the task
   needs it?** → `skill` (`skills/<scope>/<name>/SKILL.md`). A skill can call a
   CLI or REST API directly — this is the default home for most integrations.
3. **Structured interactive tool surface (held-open session, streaming, auth
   handshake, live structured browsing) that more than one host calls
   repeatedly?** → `MCP` server — but only if it also clears the two-prong
   connector test (universal **and** MCP genuinely beats a wrapped CLI/API).
4. **Simple local action?** → `CLI` entry-point or repo script, wrapped by a
   skill if it needs surrounding guidance.
5. **One narrow remote step inside a larger workflow?** → direct `API` call from
   the skill or script.

When two surfaces both work, prefer the smaller one: lower token overhead, fewer
external moving parts. Start small and promote to a connector only when the
server boundary pays for itself. Aegis ships **no default MCP connectors** — the
full rationale and the 64-character tool-name gateway constraint are in
[`mcp-policy.md`](mcp-policy.md).

## Canonical Frontmatter

Four fields. Plus `source: anvil:<path>` on migrated items. Plus `x-<adapter>:` extension namespace for host-specific metadata.

```yaml
---
name: stable-kebab-slug
description: One-line trigger description.
visibility: user | internal
platforms: [claude, opencode, codex, cursor, zed]
---
```

## Abilities Are Not Skills

Parent `SKILL.md` is the only registered skill (counts against host skill-listing budget). Abilities at `skills/<name>/abilities/<x>.md` are on-demand markdown fragments — no registration, no listing cost. The parent SKILL.md body references them on demand.

This pattern keeps skill discovery lean while subdividing internal logic naturally.

## Host Strategy

| Host | First Projection | Status |
|---|---|---|
| Claude Code | Native plugin (`.claude-plugin/plugin.json` + `marketplace.json`) | Shipped |
| OpenCode | Native plugin (`.opencode/plugins/aegis.js` + git-spec install) | Shipped |
| Codex | Skills-first + `AGENTS.md` + MCP ([`adapters/codex/projection.md`](../adapters/codex/projection.md)) | Shipped |
| Cursor | Generated `.cursor/rules/*.mdc` + `AGENTS.md` + MCP | deferred (~v0.5.0) |
| Zed | Generated `.rules` + `AGENTS.md` + MCP + ACP host | deferred (~v0.5.0) |

Detailed projections in `adapters/<host>/projection.md`.

### Host capability uptake

Aegis adopts high-value host capabilities surfaced in the host-docs scan, Claude-first, with honest gaps on the other hosts. The single source of truth for per-host capability status is [`manifest/capabilities.json`](../manifest/capabilities.json); the human-readable views ([`docs/harnesses.md`](harnesses.md) and [`docs/capability-matrix.md`](capability-matrix.md)) are **generated** from it by `scripts/sync-capabilities.mjs` and must not be hand-edited.

| Capability | Claude | OpenCode | Codex / Cursor / Zed |
|---|---|---|---|
| Generated-tree projection (`x-claude.*` flattened, `${TEMPLATE}` + model alias resolution, provider-tagged prose forked) | Supported | Filesystem-discovers canonical; literal `${TEMPLATE}` still a gap | per `capabilities.json` |
| `x-claude.paths` skill glob activation | Supported | Gap | gap / n-a (Cursor/Zed deferred ~v0.5.0) |
| `x-claude.agent` skill→subagent auto-dispatch | Supported | Partial | gap / n-a |
| Agent `tools:` permission allowlist (from `manifest/permissions.json`) | Supported | Supported (`agent.<name>.permission`) | gap / n-a |
| `userConfig` install prompts | Supported | Gap | gap / n-a |
| Background monitors (`experimental.monitors`) | Supported (honest contract — see Security posture / projection) | Gap | gap / n-a |
| Plugin `dependencies` skeleton | Partial (empty `[]`) | Partial | gap / n-a |
| `.skill` ZIP distribution (`dist/aegis.skill`) | Supported | Partial | partial / n-a |
| Model intent tiers (`manifest/models.json`) | Supported — `deep`/`balanced`/`fast`/`inherit` resolve to a Claude-native ID | Gap — Aegis emits no `model:`; OpenCode owns model selection | Gap — Aegis emits no `model:` / n-a |
| Provider-tagged prose (`<claude>`/`<opencode>`) | Supported | Supported | partial |
| `x-claude.memory` native subagent memory | Supported — `memory: project` emitted into generated Claude agent frontmatter; host auto-injects Read/Write/Edit + first 200 lines of `MEMORY.md`. See `rules/memory-discipline.md` + `skills/core/using-aegis/abilities/recall.md`. | Gap → `.aegis-memory/MEMORY.md` fallback via `using-aegis`'s `recall` fragment | gap / n-a |

Where this table and `manifest/capabilities.json` could diverge, `capabilities.json` wins — it is the lint-enforced source (F1 in `scripts/validate-structure.mjs`).

### Claude generated-tree projection

Claude no longer discovers canonical surfaces in place. `scripts/project.mjs` runs a `projectClaude()` step that generates a Claude-native tree under `adapters/claude/{skills,agents}/` and regenerates `.claude-plugin/plugin.json` to point its `skills`/`agents` keys at that tree (DH1). The generated tree is **committed** to the repo (DH2) — Aegis installs via git spec with no build step on the user's machine, so a gitignored tree would leave `plugin.json` pointing at files that don't exist. Canonical `skills/` and `agents/` remain the only authoring source; `project.mjs` is idempotent and deterministic, and `scripts/validate-structure.mjs` fails on any drift between canonical+manifest inputs and the committed tree (DH4). Per-host details and the full transform pipeline live in [`adapters/claude/projection.md`](../adapters/claude/projection.md).

## Security posture

Aegis ships an **agent-level trust boundary** declared once in [`manifest/permissions.json`](../manifest/permissions.json) — the single source of truth for what each subagent may do. The posture is **read-only baseline, opt-in elevation**: agents default to a `RO` bucket (`Read`, `Grep`, `Glob`) and only the agents that genuinely need to write or execute are elevated, each with a recorded `justification`.

This canonical manifest projects per host:

- **Claude Code** — flattened into each generated agent's native `tools:` allowlist under `adapters/claude/agents/`, plus a plugin-level `deny` list (secret-file reads, destructive `Bash`) honoured at the plugin layer.
- **OpenCode** — the `.opencode/plugins/aegis.js` `config(cfg)` hook reads the manifest at runtime and sets `agent.<name>.permission` per agent, plus a global `permission.read` / `permission.bash` deny translated from the same `plugin.deny[]` list.
- **Codex / Cursor / Zed** — **advisory only.** No host primitive enforces a per-agent tool boundary today; the read-only intent travels as agent-body prose, recorded as a gap in each host's `projection.md` and `manifest/capabilities.json`.

The manifest never carries host-native frontmatter; Claude `tools:` are injected at projection time and OpenCode permissions are applied at runtime, so the lean canonical frontmatter (Iron Law 3) and manifest-as-source both hold. See [`docs/agent-permissions.md`](agent-permissions.md) for the full guide (bucket definitions, per-agent table, and the elevation rationale).

## Sparse Guidance Files

`AGENTS.md` lives only at the repo root and at each main surface folder root. `CLAUDE.md` is a one-line stub importing the sibling `AGENTS.md`. Nested folders inherit.

This prevents the "every folder has its own AGENTS.md" sprawl that bloats agent context.

The approved guidance folder list is enforced by `scripts/validate-structure.mjs` and lives in `manifest/aegis.manifest.json` `guidanceFolders`.

## Validation

`scripts/validate-structure.mjs` runs in under 30 seconds, ALWAYS. The script enforces this as a hard ceiling — exceeding it fails the build. Validation checks:

- Required root files exist.
- Sparse guidance placement.
- Frontmatter conformance to the lean 4-field schema (and rejection of the retired `kind:` key).
- Manifest validity.
- No stray content.

`scripts/inventory.mjs` counts canonical surfaces and emits JSON.

## Release Cadence

Aegis built up in stages during pre-launch development: the full Anvil portable
port and Claude plugin came first, followed by the OpenCode and Codex
projections, statusline presets and templates surface expansion, the host-docs
feature uptake (capability matrix, Claude generated-tree projection, agent
permissions, monitors, `.skill` distribution), reference-derived hardening
(validator split, warn-only rules, the security-scan triplet), portable hook
intents, and full template coverage with multi-format output selection.

| Release | Outcome |
|---|---|
| v0.1.0 | Public launch; HTML coverage gate; stable plugin contract (3 active hosts) |
| v0.5.0 (deferred) | Cursor + Zed projections |

See [`docs/roadmap.md`](roadmap.md) for the current roadmap.

## Reference

Decisions live in `.aegis/specs/features/ag-NNNN-*/decisions.md`. Research notes in `.aegis/research/*.research.md`.
