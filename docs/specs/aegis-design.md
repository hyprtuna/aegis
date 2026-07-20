# Aegis Design

Aegis is a CLI-free, plugin-first, agentic AI development system. It carries Anvil's content (skills, agents, commands, rules, hooks, templates) into a portable plugin shape that projects natively into Claude Code, OpenCode, Codex, Cursor, and Zed.

## Decisions Locked

1. **Architecture: Hybrid canonical + minimal adapters.** Canonical content at top-level (`skills/`, `agents/`, `commands/`, `hooks/`, `rules/`, `templates/`). Each host reads from its native location at repo root (`.claude-plugin/`, `.opencode/`, `.codex-plugin/`, `AGENTS.md`, `.cursor/`, `.rules`). `adapters/<host>/` holds projection notes + gap docs only — never duplicated content. `scripts/project.mjs` regenerates host-specific generated files from canonical.
2. **Initial scope: Canonical port + working Claude plugin.** Full Anvil parity for portable content; a `.claude-plugin/plugin.json` + `marketplace.json` so users can install Aegis as a Claude Code plugin from local path.
3. **Surface model: Skills with on-demand ability fragments.** Parent skill at `skills/<name>/SKILL.md` is the only registered skill. Abilities live at `skills/<name>/abilities/<ability>.md` as plain markdown (no frontmatter or minimal) — NOT registered. Parent SKILL.md body references them on demand.
4. **Port volume: Full Anvil parity** for portable content. Everything portable from Anvil is migrated; Anvil-coupled addenda (`_addenda/`, `*-anvil-addendum.md`) and CLI-only commands are rewritten or deferred.
5. **Frontmatter: Lean 4-field.** `name, description, visibility, platforms`. (`kind` is retired — derivable from the directory, recognised by no host, already dropped at projection.) `source` added only on migrated items. Adapter-specific metadata uses `x-<adapter>` extension namespace.
6. **Commands: Hybrid.** Skills auto-expose as `/<skill-name>` on hosts that support it. `commands/` holds explicit workflow entry-points (`/quick`, `/discuss`, `/tdd`, `/review`, etc.) capped at ~15.
7. **Hooks & statusline: Deferred initially** except a single Claude `SessionStart` bootstrap hook at launch.
8. **HTML output: 3 templates at launch, full coverage by v0.1.0.** `implementation-plan.html`, `code-review.html`, `status-report.html`. Coverage tracked in `.aegis/index/html-templates.md`.
9. **Guidance files: Sparse.** `AGENTS.md` at repo root and at each main surface folder root. `CLAUDE.md` is a one-line stub importing the sibling `AGENTS.md`. Nested folders inherit.
10. **Validation: Lightweight Node scripts** with explicit `<30s` runtime ceiling baked into `scripts/AGENTS.md`.
11. **Manifest: `manifest/aegis.manifest.json`** + `manifest/schemas/aegis-surface.schema.json` (JSON Schema).

## Canonical Surfaces

| Surface | Path | Purpose |
|---|---|---|
| Skills | `skills/<name>/SKILL.md` | Reusable capabilities and domain knowledge. |
| Abilities | `skills/<name>/abilities/<ability>.md` | On-demand fragments owned by a parent skill. NOT registered. |
| Agents | `agents/<name>.md` | First-class doers that orchestrate skills and workflows. |
| Commands | `commands/<name>.md` | User-facing workflow entry-points (capped ~15). |
| Rules | `rules/<name>.md` and `skills/languages/<lang>/rules/*.md` | Short always-loaded guidance. |
| Hooks | `hooks/<event>.md` (intent) + `.claude-plugin/hooks/...` (impl) | Deferred initially; launch ships SessionStart for Claude only. |
| Templates | `templates/{markdown,json,html,prompts,...}` | Reusable output skeletons. |
| Adapters | `adapters/<host>/projection.md` | Projection notes + gap docs. NO content duplication. |
| Manifest | `manifest/aegis.manifest.json` + `schemas/*.json` | Machine-readable surface contract. |
| Scripts | `scripts/*.mjs` | Maintainer-only Node scripts. Not user-facing. |

## Repo Layout

```
aegis/
├── README.md
├── CONTRIBUTING.md
├── AGENTS.md
├── CLAUDE.md                       # 1-line @./AGENTS.md import
├── CHANGELOG.md
├── package.json                    # scripts only; no runtime deps
├── manifest/
│   ├── aegis.manifest.json
│   └── schemas/aegis-surface.schema.json
├── skills/
│   ├── core/<name>/SKILL.md        # universal
│   ├── languages/<lang>-developer/
│   │   ├── SKILL.md
│   │   ├── abilities/<ability>.md  # fragments
│   │   └── rules/{coding-style,patterns,security,testing}.md
│   └── workflows/<workflow>/
│       ├── SKILL.md
│       └── abilities/<step>.md
├── agents/<name>.md
├── commands/<name>.md
├── hooks/
│   └── sessions/session-start.md   # intent doc
├── rules/<name>.md                  # universal always-loaded rules
├── templates/
│   ├── markdown/{plans,specs,...}/default.md
│   ├── json/{plans,decisions,...}/
│   ├── html/{implementation-plan,code-review,status-report}.html
│   └── prompts/<workflow>/...
├── adapters/
│   ├── claude/projection.md
│   ├── opencode/projection.md
│   ├── codex/projection.md
│   ├── cursor/projection.md
│   └── zed/projection.md
├── docs/                            # user/contributor docs
├── scripts/{inventory,validate-structure,project,doctor}.mjs
├── .claude-plugin/
│   ├── plugin.json                  # Claude reads here
│   ├── marketplace.json
│   └── hooks/session-start.sh
└── .aegis/                          # planning/control; not shipped to hosts
    ├── AGENTS.md
    ├── CLAUDE.md
    ├── _ticket-counter.txt
    ├── audits/, index/, plans/, prompts/, research/, specs/, tasks/
```

## Runtime Flow

```
user prompt
  → host loads Aegis bootstrap (SessionStart hook or AGENTS.md)
  → routing rule classifies request
  → command, skill, or agent selected
  → skill body references abilities/<x>.md on demand
  → hooks/guardrails enforce constraints
  → templates render output as Markdown, JSON, or standalone HTML
```

## Adapter Strategy

| Host | First Projection | Status at launch | Notes |
|---|---|---|---|
| Claude Code | Native plugin | **Shipped** | `.claude-plugin/plugin.json` + marketplace.json + SessionStart hook |
| OpenCode | Native plugin | Documented gap, planned early | skills + AGENTS.md + MCP |
| Codex | Skills-first | Documented gap, planned early | skills + AGENTS.md + MCP |
| Cursor | Rules-only | Documented gap, planned later | `.cursor/rules/*.mdc` + MCP |
| Zed | Rules + ACP host | Documented gap, planned later | `.rules` + AGENTS.md + MCP |

## Release Architecture

This is the original pre-launch roadmap, kept for historical context — see
[`docs/roadmap.md`](../roadmap.md) for what actually shipped and what's next.

| Phase | Outcome |
|---|---|
| Foundation | Canonical Anvil port + Claude Code projection working. Full Anvil parity for portable content. |
| Host expansion | OpenCode projection (native agents/commands/skills/plugin), then Codex projection (skills-first), then Cursor + Zed projections (rules-first). |
| Hooks | Portable hook intents + adapter hook implementations beyond SessionStart. |
| Hardening | Statusline schema + host adapters; portable guardrails; transcript-based validation. |
| v0.1.0 | All html-effectiveness pattern families covered; coverage gate enforced; public launch. |
