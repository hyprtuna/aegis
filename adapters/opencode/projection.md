# OpenCode Projection

**Status:** shipped; agent permissions added in a later release. Plugin at `.opencode/plugins/aegis.js`; install doc at `.opencode/INSTALL.md`; agents generated at `.opencode/agents/`; commands generated at `.opencode/commands/`. Generator: `node scripts/project.mjs`. The `config(cfg)` hook applies per-agent + global permissions from `manifest/permissions.json` at runtime (see Agent Permissions).

## Approach (locked decisions)

- **Plugin file:** `.opencode/plugins/aegis.js` — plain ESM JS, no build step (~100 lines).
- **Distribution:** OpenCode's native git-spec; users add `"plugin": ["aegis@git+https://github.com/.../aegis.git"]` to `opencode.json`. Mirrors Superpowers' pattern.
- **Install instructions:** `.opencode/INSTALL.md` (agent-readable) tells an AI agent how to edit the user's `opencode.json`. NO install script Aegis runs.
- **Skill discovery:** Plugin `config(cfg)` pushes 3 absolute paths into `cfg.skills.paths` (`skills/core`, `skills/languages`, `skills/workflows`).
- **Bootstrap:** `experimental.chat.messages.transform` injects the `using-aegis` SKILL body into the first user message, guarded by `<!-- aegis:bootstrap -->`. The bootstrap embeds the iron-law rules.
- **Bootstrap (verified):** `.opencode/plugins/aegis.js` caches the parsed `using-aegis` bootstrap at module level — computed once at plugin-factory init (`aegis.js:50,128`), not per turn. It guards against double-injection with the `<!-- aegis:bootstrap -->` marker (`aegis.js:176-179`) and injects into the **first USER message** (`aegis.js:171`), not a system message — avoiding per-turn token bloat and the multi-system-message breakage some models exhibit. This confirms the superpowers-audit recommendations were already satisfied.
- **Agents:** Generated `.opencode/agents/<name>.md` with `mode: subagent` for 17, `mode: primary` for `orchestrator`.
- **Commands:** Generated `.opencode/commands/<name>.md`. `argument-hint` is a Claude-only command field (not documented for OpenCode's `config.command`) and is intentionally NOT promoted here (v0.1.3) — it stays only on the Claude command carrier.
- **Rules:** Embedded in bootstrap text, NOT via `cfg.instructions[]` (per Superpowers' tested approach; avoids per-turn token cost).

## What OpenCode Will Load

| Aegis canonical | OpenCode native path |
|---|---|
| `skills/<scope>/<name>/SKILL.md` | `.opencode/skills/<name>/SKILL.md` (or via `skills.paths` config pointing at canonical) |
| `agents/<name>.md` | `.opencode/agents/<name>.md` |
| `commands/<name>.md` | `.opencode/commands/<name>.md` |

**Dogfooding double-registration (maintainer-only, v0.1.3).** When cwd is
the Aegis repo itself, OpenCode natively discovers the generated `.opencode/agents/*.md`
and `.opencode/commands/*.md` files (unprefixed names) alongside the plugin's own
`aegis-`-prefixed inline `cfg.agent`/`cfg.command` entries built by `buildAgentEntries()`/
`buildCommandEntries()` (`.opencode/plugins/aegis.js:162-199`) — so a maintainer running
OpenCode inside the clone sees each agent/command twice (once unprefixed via native
discovery, once `aegis-`-prefixed via the plugin). This only bites maintainers dogfooding
in the repo, never end users installing via the git-spec plugin install (who never have
`.opencode/agents|commands/` in their own project). It is inherent to shipping the
generated `.opencode/` tree inside the same repo that also loads as a plugin; no code
change removes it without breaking end-user distribution. Honest gap, not a silent drop.
| `rules/<name>.md` | Concatenated into `AGENTS.md` or referenced via `instructions:` glob |
| Hooks | Plugin `.opencode/plugins/aegis.js` event handlers |
| Permissions | Per-agent `agent.<name>.permission` + global `permission` deny, applied at runtime by the `config(cfg)` hook from `manifest/permissions.json` |

## OpenCode Skill Discovery

OpenCode walks several paths for skills (priority order):
1. `~/.claude/skills/`
2. `~/.agents/skills/`
3. `<proj>/.claude/skills/`
4. `<proj>/.agents/skills/`
5. `.opencode/{skill,skills}/`
6. `~/.config/opencode/{skill,skills}/`
7. `skills.paths` config
8. `skills.urls` (remote)

Aegis can use option 7 to point at canonical `skills/` directly OR option 5 to mirror.

## Plugin Shim

`.opencode/plugins/aegis.js` should:
- Use `config(cfg)` loader hook to push `skills.paths` pointing at the canonical `skills/`.
- Register `experimental.chat.messages.transform` for bootstrap injection (idempotency marker pattern from Anvil's `src/opencode-plugin/index.ts`).
- Map portable hook intents to OpenCode event names.

## Constraints (V/U marked)

- V: Skills auto-expose as `/<skill-name>` slash commands unless an explicit command of that name exists.
- V: Permissions are tri-state with glob support and last-match-wins.
- V: Agent modes: `primary | subagent | all`.
- V: Hook plugin gets `{ project, directory, worktree, client, $ }` and returns hooks object.
- U: Field-level shape of some experimental hooks across OC versions.

## Persistent Memory (gap)

OpenCode has no native subagent `memory` primitive equivalent to Claude's `memory:` frontmatter
field. `x-claude.memory` is NOT emitted into `.opencode/agents/*.md`.

**Fallback:** use a plain `.aegis-memory/MEMORY.md` file at the project root as the cross-host
memory store. The `recall` skill's Layer 1 (Grep) and Layer 3 (Read) work identically on
OpenCode — only Layer 2 (Claude's 200-line auto-injection) is absent. Start with Layer 1 on this host.

**Decay:** real decay / last-referenced scoring needs a store — deferred. Honest gap.

## Unsupported (Documented Gaps)

| Canonical concept | OpenCode native? | Strategy |
|---|---|---|
| Statusline | No plugin slot | Use `tui.toast.show` for ephemeral; gap documented. |
| Claude-style hook JSON config | No — uses in-process plugin | Map Aegis intents to OC handlers via `hooks/map.ts` pattern. |
| UserPromptSubmit / Notification / Stop / SubagentStop | No direct counterpart | Documented gap; consider session.idle / chat.messages.transform alternatives. |
| `.claude/settings.json` permissions schema | Different shape | Project as `permission` block in `opencode.json`. |
| `@rules/<file>.md` agent hotlinks | No `@`-include resolution | Three skeptical agents (`code-reviewer`, `code-quality-reviewer`, `doc-verifier`) reference `@rules/skeptical-stance.md` for Claude auto-inheritance; OpenCode ships the literal `@rules/...` as prose. Each agent retains a one-line inline stance summary so the doctrine survives. Honest gap, not a silent drop. |
| `x-claude.memory` / native subagent memory | No native primitive | Fallback: `.aegis-memory/MEMORY.md` read by the `recall` skill (Read+Grep, host-neutral). Auto-injection and persistent-dir wiring are Claude-only. Decay deferred. |
| Native subagent execution-profile fields (`effort`, `maxTurns`, `background`, `isolation`) | No native primitive | Claude-plugin-only (cc-docs sub-agents.md, plugins-reference.md). OpenCode has no per-agent equivalent, so they are not projected here (they live only in the Claude agent tree). |

## Hook capability matrix

OpenCode has no Claude-style hook-JSON config and no LLM-evaluated hook primitive,
so only the bootstrap and compaction intents have an OpenCode home. The compaction
pair binds to `experimental.session.compacting` — whose field shape **is now
documented** (`opencode-docs/docs/18-plugins.md:329-333`): `input { sessionID }` →
`output { context: string[], prompt?: string }` (D8 corrected). The REAL
gap is that OpenCode's `session.compacting` is a **single combined hook** with no
`phase` parameter — it fires once per compaction event, before the LLM summarises
the context. Aegis's canonical model exposes distinct `pre-compact` / `post-compact`
intents (pre = inject guidance before summarisation; post = react after). A correct
projection would require either (a) treating `session.compacting` as `pre-compact`
only and accepting that `post-compact` has no OpenCode home, or (b) deferring both
until this pre/post semantics gap is resolved. Current stance: the generated
`AEGIS:HOOKS-GEN` region in `.opencode/plugins/aegis.js` remains a **no-op
placeholder** (`const aegisCompaction = async (_input, _output) => {}`), phase
dispatch is deferred, and the OpenCode rows stay `partial`. The canonical
`pre-compact` / `post-compact` intents project **fully to Claude** (`PreCompact` /
`PostCompact` command hooks). Every judgment hook and every Claude-only lifecycle
event is a `gap` — documented here, never silently dropped.

| Intent / name | Status | OpenCode binding | Notes |
|---|---|---|---|
| `session-start` | supported | `chat.messages.transform` (bootstrap) | Existing bootstrap transform. `experimental.chat.messages.transform` is a **verified-real** OpenCode hook (`opencode-docs/docs/18-plugins.md:317`) — a prior audit false-positive; do not re-flag. |
| `pre-compact` | partial | `session.compacting` | Shape verified (D8): `input {sessionID}` → `output {context:string[], prompt?}`. Real gap: no `phase` param — single hook, no pre/post split. No-op placeholder; phase dispatch deferred. Full projection on Claude only. |
| `post-compact` | partial | `session.compacting` | Same combined hook; no `phase` param means `post-compact` has no distinct OpenCode home. No-op placeholder; deferred. Full projection on Claude only. |
| `pre-tool-use-deny` | gap | — | Enforced via the `config(cfg)` permission block, not a hook; no PreToolUse hook event. **Git guard:** the force-push / `reset --hard` / `restore` / `clean` destructive-ops guard is Claude-only — OpenCode has no equivalent runtime command-classification hook, so it inherits this gap (approximable via `permission.bash` literal matchers, with the same evasion caveat noted above). The protected-branch push check is a **second, distinct gap**: it emits `permissionDecision: "ask"`, a Claude PreToolUse value with no OpenCode counterpart. OpenCode's static `permission.bash` map has an `"ask"` value, so the *decision* is expressible, but only against literal command patterns — it cannot parse a push's refspecs to tell `git push origin main` from `git push origin feat/x`, so a faithful projection is not available. `permission.ask` runtime hook evaluated — see decisions below. Users wanting this on OpenCode use forge branch protection or a local `pre-push` hook, per `rules/protected-branch-discipline.md`. |
| `instructions-loaded` | gap | — | No `InstructionsLoaded` counterpart. |

## Statuslines

No host-scriptable status row. OpenCode's TUI titlebar and bottom prompt area are fixed — there is no plugin slot to render a persistent statusline. `tui.toast.show(...)` is ephemeral (a transient notification), not a statusline, and Aegis does NOT route statusline content through it as a silent toast-based fallback. The Aegis statusline presets are canonical (`statuslines/`), so a future OpenCode hook could render them if OpenCode ever exposes a status-row slot. Today this is an honest gap.

## Dynamic workflows (gap)

Claude Code's dynamic workflows are a host-resident built-in (`Workflow` tool): the model writes a JS orchestration script and a background runtime fans it out across dozens-to-hundreds of subagents, saving reusable scripts to `.claude/workflows/`. This is not a plugin extension point — Aegis cannot ship, declare, or project it, and no equivalent exists on this host. The portable substitute is the `orchestration` skill (≤5-wave `Task()` fan-out with in-session synthesis), which runs identically everywhere but does not reach the hundreds-of-agents, context-isolated, resumable regime. For very large audits/migrations on this host, the ≤5-wave skill is the ceiling.

## Agent Permissions

OpenCode does **not** honour a `permission:` key in agent markdown frontmatter — per-agent permissions must live under `agent.<name>.permission` in config. The `.opencode/plugins/aegis.js` `config(cfg)` hook reads [`manifest/permissions.json`](../../manifest/permissions.json) at runtime (the single agent-level trust boundary) and applies the posture in two places (D4/D5):

- **Per-agent (D4):** for each agent in the manifest, sets `cfg.agent["aegis-<name>"].permission = spec.opencode` — the tri-state map of `read`/`grep`/`glob`/`list`/`bash`/`task` etc. (e.g. read-only reviewers get `{ "*": "deny", "read": "allow", "grep": "allow", "glob": "allow", "list": "allow" }`). It writes only when `.permission` is absent, so user pins and re-runs of the hook are never clobbered.
- **Global cross-cutting deny (D5):** translates the manifest's `plugin.deny[]` into OpenCode's global `permission` block — `Read(<glob>)` denies become `permission.read.{<glob>: "deny"}` and `Bash(<cmd>)` denies become `permission.bash.{<cmd>: "deny"}`. `./`-prefixed paths are anchored as `**/`-globs so they match at any depth. Tool denies with no OpenCode global equivalent are an honest gap (no false enforcement).
  - **Caveat (within-Bash patterns):** the `read` glob denies (`**/.env`, `**/secrets/**`, `~/.ssh/**`) are reliable, but a `Bash(curl * | sh)`-style deny is matched by OpenCode's command matcher as a literal command-string pattern; embedded pipes/option-reordering can evade it (the same fragility `permissions.md:150-164` warns about on Claude). Treat the within-Bash denies as best-effort, not airtight. Claude enforces the same Bash patterns more robustly via the `pre-tool-use-deny.sh` PreToolUse hook. The `permission.ask` runtime hook (documented in `opencode-docs/docs/18-plugins.md:154-168`) was evaluated as a potential improvement path — see the build-or-defer decisions below.

If the manifest is missing or malformed, the plugin **refuses to register agents** — permissions are a security boundary, not best-effort. See [`docs/agent-permissions.md`](../../docs/agent-permissions.md) for the full per-agent table. `agent-tools-allowlist` is `opencode: supported` in `manifest/capabilities.json`.

## Templates `${TEMPLATE}` gap (still open on OpenCode)

OpenCode filesystem-discovers canonical skills (via `skills.paths` pointing at canonical `skills/`) with **no skill-body transform step**, so the `${TEMPLATE:<family>}` directive is **NOT resolved** on OpenCode — the consumer skills render the literal directive here. Unlike Claude (which gained a generated-tree transform), OpenCode still discovers canonical files in place, so this remains an open `partial` (`templates-surface`) until OpenCode gets its own skill-body transform. (Codex resolution is live and verified.)

**HTML output reachability (v0.1.1).** The runtime format-resolution procedure
in `rules/user-choice-discipline.md` (step 5) reads
`${CLAUDE_PLUGIN_ROOT}/manifest/template-index.json` and `Read`s the chosen
template under the plugin root. Only **Claude** closes HTML end-to-end: it has
a `${CLAUDE_PLUGIN_ROOT}` token, so the runtime read resolves. **Codex now
bundles the substrate** — `templates/html`, `templates/json`, and
`template-index.json` ship into its plugin tree (see the Codex projection
doc), which fixes the pre-existing `:json` bundled-pointer gap — but Codex has
**no equivalent base-path token** (`project.mjs` never emits
`${CLAUDE_PLUGIN_ROOT}` for `host === "codex"`), so an agent following step 5
still cannot resolve the runtime read; HTML selection stays a documented
`partial` on Codex, the same class of gap as OpenCode. **OpenCode** has
**no plugin-root environment variable at all** — canonical files are
discovered in place with no transform step and no stable base-path token an
agent can resolve at runtime. On both Codex and OpenCode, Q2 may still offer
HTML (the option set is index-driven, not host-gated), but the runtime `Read`
of the template body has no resolvable path today.

## Unsupported (Documented Gaps)

The following capabilities are **Claude-only** and have no OpenCode equivalent. Each is a `gap`/`partial`/`n-a` row in [`manifest/capabilities.json`](../../manifest/capabilities.json) — the source of truth; this list must not contradict it.

| Capability | OpenCode status | Why |
|---|---|---|
| `userConfig` install prompts | gap | No install-time config-prompt primitive in the OpenCode plugin model. |
| Background monitors | gap | No monitor primitive; `tui.toast.show` is ephemeral, not a persistent watcher. |
| `x-claude.paths` skill glob activation | gap | No path-glob skill activation; language routing stays manual. |
| `x-claude.agent` skill→subagent auto-dispatch | partial | Skills auto-expose as `/<skill-name>`; no native skill→subagent auto-dispatch binding. |
| Plugin `dependencies` skeleton | partial | No native plugin-dependency manifest; single git-spec install only. |
| `.skill` ZIP distribution | partial | Installs via OpenCode's git-spec; the `dist/aegis.skill` ZIP is a Claude `--plugin-url` artifact. |
| `x-claude.skills` subagent preload | gap | Claude subagents support a `skills:` frontmatter list that preloads named skill bodies at startup. OpenCode has no equivalent subagent-startup skill-preload primitive; the field is Claude-only and is NOT emitted into `.opencode/agents/*.md`. |
| Per-agent model (authoring-time, `manifest/permissions.json` D3) | gap | Claude agent frontmatter carries a `model:` field projected from `manifest/permissions.json` (D3 single-source — `x-claude.model` on canonical frontmatter is intentionally FORBIDDEN; the hard-fail guard in `project.mjs` `flattenXClaude()` prevents re-introduction). OpenCode has no equivalent agent-frontmatter model override that the plugin can set; model selection stays at the user/session level. |

Model aliases (`manifest/models.json`) and provider-tagged prose (`<opencode>…</opencode>`) ARE supported on OpenCode — see `manifest/capabilities.json`.

## Build-or-Defer Decisions

Three OpenCode experimental features were evaluated for adoption. Each has a documented API shape in
`opencode-docs/docs/18-plugins.md`; the evaluation criterion is: clean + low-risk + statically-verifiable
AND confirmed by docs. We have no OpenCode CLI for runtime verification.

### `experimental.compaction.autocontinue` — DEFER

**What it does:** Intercepts the post-compaction turn. `input: {sessionID, agent, model, provider,
message, overflow}` → `output: {enabled: boolean}`. Setting `output.enabled = false` suppresses the
synthetic "continue" user message that OpenCode injects after compaction to restart the conversation.

**Evaluation:** Aegis has no use case requiring suppression of the autocontinue turn — the intent is
compaction guidance injection (a `pre-compact` concern), not turn-skipping. Building this now would
be adopting an API without a real requirement. Deferred until a concrete need emerges.

### `permission.ask` runtime hook — DEFER

**What it does:** Intercepts permission decisions before they reach the user.
`input: Permission request object` → `output: {status: "ask" | "deny" | "allow"}`. The docs show
`input.permission === "bash"` gating but do not specify the full Permission input shape — in
particular, whether the specific Bash command string is exposed, and what field carries it.

**Evaluation:** The flagged fragility (`projection.md` Agent Permissions caveat) is that static
`permission.bash` literal matchers in `config()` can be evaded by option-reordering or pipe
composition. `permission.ask` could in principle improve this by allowing programmatic pattern-matching
at runtime. However: (1) the docs do not show the full `input` shape for Bash permissions — there is
no documented field confirming the command string is accessible; (2) any implementation would execute
unverified logic on a live permission decision; (3) the existing `config(cfg)` deny block is already
best-effort by design (documented, not silently dropped). Honest-gaps discipline: a runtime security
hook built against an under-documented input shape and with no runtime testing path would be worse than
the current documented caveat. DEFER. Re-evaluate when docs show the full Permission input shape and
a test path exists.

### `experimental.chat.system.transform` — DEFER

**What it does:** Adds entries to the system-prompt array before each LLM call.
`input: {sessionID?, model}` → `output: {system: string[]}`. Pushing to `output.system` injects into
the system prompt, which is a cleaner channel than the current user-message bootstrap inject.

**Evaluation:** The current bootstrap via `experimental.chat.messages.transform` (user-message inject
with `<!-- aegis:bootstrap -->` idempotency guard) is verified and working. Switching
channels is a behavioral change with real risk: (1) the current approach is battle-tested and
explicitly confirmed per-audit; (2) system prompt injection via this hook may
interact differently with multi-turn context, compaction, or per-model system-prompt handling;
(3) the current approach deliberately targets the FIRST USER MESSAGE to avoid per-turn token bloat —
a system-transform hook would need equivalent deduplication logic to avoid adding Aegis bootstrap on
every turn. A blind switch without controlled testing would be reckless. DEFER pending a controlled
A/B validation on a non-primary session, not a production swap.

## Early Plan

Plan file lives in the private planning repo (authored alongside the initial OpenCode port).
