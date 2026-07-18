# Zed Projection

**Status:** two paths, two statuses. **Zed via OpenCode ACP is reachable today** — no
new Aegis code, see below. The **native Zed extension** (a first-class Aegis
extension shipping its own skills/statusline/hooks as Zed primitives) stays
deferred to ~v0.5.0 — see [`docs/roadmap.md`](../../docs/roadmap.md).
The hook-capability matrix below documents the native-extension gaps and is
authoritative for that path.

## Zed via OpenCode ACP

Zed integrates with OpenCode over ACP (Agent Client Protocol): add `opencode acp`
to `~/.config/zed/settings.json` (see `docs/getting-started.md` for the full
config and verification steps — canonical detail lives there, not duplicated
here). Over ACP, Zed launches the **full OpenCode engine** as a subprocess, so
canonical Aegis surfaces the OpenCode plugin already carries — skills,
`.opencode/commands/` slash commands, and agents/modes — are available inside
Zed with **zero new Aegis code**. Slash commands over ACP are documented to
work by the upstream ACP reference; skills/agents registration over ACP is
documented to work the same way but has **not yet been hands-on verified**
(see honest gaps below).

Honest gaps specific to the ACP path (not the native-extension gaps below):

- `OPENCODE_ENABLE_QUESTION_TOOL=1` must be set in the environment that launches
  `opencode acp`, or `AskUserQuestion` / `user-choice-discipline` degrades
  silently (the question tool is disabled by default under ACP).
- `/undo` and `/redo` are unsupported over ACP (upstream OpenCode limitation).
- **Skills/agents registration over ACP — documented, not yet hands-on
  verified.** The ACP reference documents commands-over-ACP explicitly, but
  does not document plugin `config.skills.paths`-style registration loading
  the same way; treat skills/agents-over-ACP as expected-but-unconfirmed.
- Whether the bootstrap's `experimental.chat.messages.transform` hook fires
  when OpenCode is launched via `opencode acp` is **unverified** — treat it as
  unverified, not confirmed working.

## What Zed Will Load (native Zed extension)

The table below describes the **native Zed extension** path (deferred,
~v0.5.0) — a first-class Aegis extension exposing canonical surfaces as Zed
primitives. It does not describe the ACP path above, which is reachable
today (see the honest gaps noted there for what remains unverified).

| Aegis canonical | Zed native | Status |
|---|---|---|
| `rules/<name>.md` + iron laws | `.rules` at project root (generated, concatenated) | V |
| `AGENTS.md` | Read by Zed natively | V |
| MCP server entries | `context_servers` config | V |
| ACP external agents (Claude, Codex, OpenCode) bring their own skills | Pass-through | V |
| Skills as a native Zed primitive | — | No native |
| Subagents native to Zed | — | No native |
| Hooks in Zed Agent Panel | — | No native |
| Slash commands native to Zed | Zed Agent Panel supports them; external-agent slash commands pass through | V (limited) |

## Strategy

**Rules-only native extension + ACP external-agent host.** For the native Zed
extension, Zed is treated as a thin shell that defers to Claude/Codex/OpenCode
plugins running over ACP. The ACP path above already delivers commands and
(expected, not yet hands-on verified) skills/agents through the embedded
OpenCode engine; the native-extension work below is about giving Zed itself
first-class primitives (statusline, hooks, skills) independent of any
embedded agent.

- Generate `.rules` from canonical (concatenated iron-laws + bootstrap pointer to AGENTS.md).
- `AGENTS.md` at root is already present.
- MCP/`context_servers` entries projected if Aegis ships any.

Aegis CAN'T ship a "Zed plugin" with native primitives today. For the native
extension, Aegis exposes itself to Zed users by being already installed in the
Claude/Codex/OpenCode agent that Zed routes to over ACP — the OpenCode case of
this is now a documented, working install path (see above), not merely a
future plan.

## Constraints

- Hooks and agent teams from Claude/Codex projections are NOT passed through Zed's ACP boundary (per Zed external-agents docs).
- Zed compatibility-reads: `.cursorrules`, `.windsurfrules`, `.clinerules`, `.aider.conf.yml`, `.goosehints`. Aegis does NOT ship duplicates of these — `.rules` + `AGENTS.md` is enough.

## Unsupported (Documented Gaps — native Zed extension)

These gaps describe the **native Zed extension** path only — a first-class
Aegis extension surfacing canonical concepts as Zed primitives directly. They
do not apply to the ACP path above, which carries skills, commands, and
agents through the embedded OpenCode engine (see the ACP path's own honest
gaps for what remains unverified there).

| Canonical concept | Zed native? | Strategy |
|---|---|---|
| Skills as a native Zed primitive | No | Document — users invoke Aegis via the embedded Claude/Codex/OpenCode agent (OpenCode via ACP is a working path today, see above). |
| Statusline | No | Document. |
| Hooks | No | Document. |
| Subagents | Only via embedded external agent | Document. |
| Structured questions | No | Document — the ACP path has its own honest gap (question tool disabled unless `OPENCODE_ENABLE_QUESTION_TOOL=1`), see above. |
| `@rules/<file>.md` agent hotlinks (v0.0.13) | No `@`-include resolution | Three skeptical agents (`code-reviewer`, `code-quality-reviewer`, `doc-verifier`) reference `@rules/skeptical-stance.md` for Claude auto-inheritance; Zed (and its ACP-embedded agents) ship the literal `@rules/...` as prose. Each agent keeps a one-line inline stance summary so the doctrine survives. Honest gap, not a silent drop. |

## Hook capability matrix (v0.0.7, AG-0010)

Zed exposes **no hook contract at all** — there is no extension point for lifecycle
hooks, and the ACP boundary does not pass an embedded agent's hooks through to Zed.
Every portable hook intent is a `gap`, documented here and never silently dropped.

| Intent / name | Status | Notes |
|---|---|---|
| `session-start` | gap | No session-hook extension point. |
| `pre-tool-use-deny` | gap | No PreToolUse hook extension point. |
| `pre-compact` | gap | No compaction hook extension point. |
| `post-compact` | gap | No compaction hook extension point. |
| `verify-no-secrets-touched` | gap | No LLM-evaluated hook primitive. |
| `no-silent-failures` | gap | No LLM-evaluated hook primitive. |
| `no-rationalization` | gap | No LLM-evaluated hook primitive. |
| `verification-before-completion` | gap | No agent-dispatch hook primitive. |
| `instructions-loaded` | gap | No `InstructionsLoaded` counterpart. |
| `file-changed` | gap | No `FileChanged` counterpart. |
| `cwd-changed` | gap | No `CwdChanged` counterpart. |
| `prompt-injection-guard` | gap | No PreToolUse hook event; advisory scanner is Claude-only. |

## Statuslines

Zed's Agent-panel footer (model/token info) is not user-scriptable — there is no extension point to render an Aegis statusline preset into it, and the ACP boundary does not pass an embedded agent's statusline through to Zed's UI. Aegis statusline presets are canonical (`statuslines/`) and first-class on Claude Code; on Zed this is an honest gap.

## Permissions

No projection. Zed has **no host primitive for agent-level tool restriction** — Zed
is a thin shell that defers to an embedded Claude/Codex/OpenCode agent over ACP,
and the ACP boundary does not pass agent teams or per-agent permission config
through to Zed's own UI. Aegis agent permissions are therefore **advisory** on Zed:
`manifest/permissions.json` documents the intended posture, and any *enforcement*
happens only inside the embedded agent that already carries the Aegis plugin (e.g.
Claude honouring its `tools:` allowlist), never at the Zed layer. Aegis does not
write enforcement prose into `.rules` that Zed won't honour. (Decision D6.)

- **Source of truth:** `manifest/permissions.json`.
- **Author guide:** `docs/agent-permissions.md`.
- **Enforced hosts:** Claude (`tools:` allowlist) and OpenCode
  (`agent.<name>.permission`) — reachable through Zed only via the embedded
  external agent; see those `adapters/<host>/projection.md`.

## v0.0.5 Claude-only uptakes (gaps)

The v0.0.5 release adds Claude-first capabilities with no Zed counterpart;
`manifest/capabilities.json` is the authoritative per-capability host-status matrix.

- **`userConfig` install prompts** — no Zed plugin-enable-time config prompts.
- **Background monitors** — no Zed equivalent.
- **Plugin dependencies / semver constraints** — no Zed plugin-dependency manifest.
- **`.skill` (ZIP) distribution** — Claude-only channel.

See `manifest/capabilities.json` for the full matrix and per-host evidence.

## Dynamic workflows (gap)

Claude Code's dynamic workflows are a host-resident built-in (`Workflow` tool): the model writes a JS orchestration script and a background runtime fans it out across dozens-to-hundreds of subagents, saving reusable scripts to `.claude/workflows/`. This is not a plugin extension point — Aegis cannot ship, declare, or project it, and no equivalent exists on this host. The portable substitute is the `orchestration` skill (≤5-wave `Task()` fan-out with in-session synthesis), which runs identically everywhere but does not reach the hundreds-of-agents, context-isolated, resumable regime. For very large audits/migrations on this host, the ≤5-wave skill is the ceiling.

## v0.5.0 Plan

Cursor and native-Zed-extension projections are deferred to ~v0.5.0 — see
[`docs/roadmap.md`](../../docs/roadmap.md).
