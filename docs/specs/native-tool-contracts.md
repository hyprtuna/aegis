# Native Tool Contracts

What each target host natively supports and how Aegis projects into it. Synthesizes `.aegis/research/{claude-code,opencode,codex,cursor,zed}-{docs,native-tools}.research.md`.

## Claude Code

| Aegis surface | Claude native | Required fields | Notes |
|---|---|---|---|
| Skill | `skills/<name>/SKILL.md` | `description` | Auto-discovered from plugin `skills/`. |
| Subagent | `agents/<name>.md` | `name`, `description` | Plugin agents lose `hooks`/`mcpServers`/`permissionMode`. |
| Slash command | `commands/<name>.md` (= skill) | `description` | Namespaced `/aegis:<name>`. |
| Hook | `hooks/hooks.json` (plugin) or inline `hooks` in `plugin.json` | event + matcher + handler | Started with ONE: `SessionStart`. |
| Statusline | `settings.json` `statusLine.command` | script path | Deferred. |
| MCP | `.mcp.json` or `mcpServers` in plugin.json | type + command/url | Out of scope initially. |
| Marketplace | `.claude-plugin/marketplace.json` | name, owner, plugins[] | Reserved names: `anthropic-*`, `claude-*-marketplace`. |

**Constraints:**
- Plugin paths must be relative, start with `./`, resolve under `${CLAUDE_PLUGIN_ROOT}`.
- Plugin-root `CLAUDE.md` is NOT loaded — guidance must be a skill.

## OpenCode

| Aegis surface | OpenCode native | Notes |
|---|---|---|
| Skill | `SKILL.md` discovered from `.opencode/{skill,skills}/` or `skills.paths` config | Auto-exposed as `/<skill-name>` command. |
| Agent | `.opencode/agents/<name>.md` | `mode: primary|subagent|all`. |
| Command | `.opencode/commands/<name>.md` | `$ARGUMENTS`, `$1..N`, `` !`shell` ``, `@path`. |
| Plugin | `.opencode/plugins/<name>.{js,ts}` | Returns hooks object. |
| Hook | Plugin event handler | `tool.execute.before|after`, `session.*`, `experimental.chat.messages.transform`, etc. |
| Permissions | `permission` in `opencode.json` | `allow|ask|deny` per key. |
| MCP | `mcp.<name>` in `opencode.json` | `type: local|remote`. |

**Gap from Claude:** No statusline plugin slot. UserPromptSubmit, Notification, Stop, SubagentStop hooks have no direct counterpart (see `anvil/src/opencode-plugin/hooks/map.ts` OC_OUT_OF_SCOPE_HOOKS).

## Codex (updated in a later modernization pass)

Verified (V) — 2026-06-20 against official Codex docs + live codex 0.141.0.
See `.aegis/research/codex-modernization.research.md §2`.

| Aegis surface | Codex native | Status | Notes |
|---|---|---|---|
| Skill | Agent Skills (folders of SKILL.md + scripts) | V | Discovered from `.agents/skills/` or plugin install cache. |
| AGENTS.md | Project root | V | Codex reads it natively. |
| MCP | `.mcp.json` (plugin-root) or `[mcp_servers.<id>]` config | V | Plugin manifest wires via `mcpServers: "./.mcp.json"`. |
| Hooks | `[hooks]` in user `config.toml` only | gap (plugin) | `[features] hooks` is stable and on by default, but that flag covers the **user**-configured `config.toml` hook path only. `[features] plugin_hooks` — the flag that would let a *plugin* ship `hooks/hooks.json` and have it fire — is **removed** (verified live, codex-cli 0.144.6: `plugin_hooks removed false`), not merely off. A plugin-distributed Aegis cannot ship a hook that fires on Codex in any context; see `adapters/codex/projection.md#hook-capability-matrix`. |
| Subagents (native) | `.codex/agents/*.toml` (one per file) | V | Fields: required `name`, `description`, `developer_instructions`; optional `model`, `sandbox_mode`, `mcp_servers`, `nickname_candidates`, `skills.config`. **Not plugin-distributable** — native `.toml` is project/personal-scoped only; Aegis folds agents into skills for plugin distribution (D-02, verified 2026-06-20). |
| Slash commands | No distinct registry | — | Commands fold into skills on this host. |

**Subagent spawning model:** interactive subagent spawning is **model-orchestrated / implicit** — Codex spawns, waits, and collects internally based on natural language. There are **no** named `spawn_agent`, `wait_agent`, or `close_agent` tools exposed to skill bodies. The only **named** tools are:
- `spawn_agents_on_csv` (experimental) — CSV batch spawn with `{column}` placeholders.
- `report_agent_job_result` — worker reports result once per CSV row.
- `/agent` CLI — switches threads.

**Multi-agent feature flags:** `[features] multi_agent` is **stable and on by default** (codex 0.141.0). `multi_agent_v2` exists in the feature list but is **under development, off by default** — do not rely on it. `plugin_hooks` has been **removed** — distinct from `[features] hooks` (stable, on by default), which covers only the user's own `config.toml` hooks; a plugin has no path to that surface.

**Strategy:** Skill-first. Ship skills + AGENTS.md + MCP; hooks are a declared gap. Native subagent (`.toml`) projection (D-02) was REVERSED — native `.toml` agents are not plugin-distributable; Aegis folds agents into skills for plugin distribution (verified 2026-06-20). Hooks projection to Codex `hooks/hooks.json` (D-03) was REVERSED: `[features] plugin_hooks` is a **removed** Codex feature (verified live, codex-cli 0.144.6), so a plugin cannot ship a hook that fires on this host at all. The three intents previously projected (`session-start`, `pre-compact`, `post-compact`) no longer bind `codex` in `platforms`; Aegis ships no Codex hook bundle. `instructions-loaded` remains a gap for the separate, pre-existing reason that Codex has no `InstructionsLoaded` event. Aegis's Codex bootstrap continues via native Skill discovery and the project-root `.codex-plugin/AGENTS.md` read.

## Cursor

| Aegis surface | Cursor native | Status |
|---|---|---|
| Rules | `.cursor/rules/*.mdc` with `alwaysApply`/`globs`/`description` frontmatter | V |
| Legacy rules | `.cursorrules`, AGENTS.md | V |
| MCP | `.cursor/mcp.json` | V |
| Skills | None native | — |
| Subagents | None native | — |
| Hooks | Manifest shape exists | U (field details) |

**Strategy:** Rules-only. Project canonical skill content into MDC rule files. Hooks projected best-effort with explicit disclosure.

## Zed

| Aegis surface | Zed native | Status |
|---|---|---|
| Rules | `.rules` at project root | V |
| Compatibility rules | AGENTS.md, .cursorrules, etc. | V |
| MCP | `context_servers` config | V |
| Skills | None native | — |
| Hooks | None in Zed Agent Panel | — |
| ACP external agents | Embedded Claude Agent / Codex with their own surfaces | V |

**Strategy:** Rules-only + ACP host. Project `.rules` + AGENTS.md + MCP. Document Zed gaps explicitly.

## Projection Decisions

1. **Hosts read from native locations at repo root.** Aegis writes there directly; no install step required for hosts that auto-discover.
2. **`adapters/<host>/projection.md`** documents projection decisions and lists gaps — NEVER duplicates canonical content.
3. **Generated files (e.g. `.cursor/rules/*.mdc`, `.rules`)** are produced by `scripts/project.mjs`. They are committed to the repo so hosts can read them without running the script.
4. **`scripts/project.mjs` is idempotent** — running it twice produces identical output.
5. **Source-of-truth is canonical** (`skills/`, `agents/`, etc.). Generated files are downstream and must never be hand-edited.
