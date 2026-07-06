# Claude Code Projection

**Status:** v0.0.5 — shipped. Headline host.

## What Claude Code Loads

| Aegis canonical | Claude native path | Notes |
|---|---|---|
| `skills/<scope>/<name>/SKILL.md` | **Generated** `adapters/claude/skills/<scope>/<name>/SKILL.md`; `plugin.json` `skills` lists the **bucket roots** `./adapters/claude/skills/{core,languages,workflows}/` | v0.0.5: repointed to the generated tree. AG-0255/AG-0256: `skills` lists bucket roots, not the 82 per-skill dirs — Claude scans each entry one level deep for `<name>/SKILL.md` and *adds* to the default scan, so per-skill paths landed one level too deep and registered zero. |
| Marketplace | **Generated** `.claude-plugin/marketplace.json` (string `source: "./"`) | AG-0255: Claude's own marketplace, separate from Codex's `.agents/plugins/marketplace.json` (object source). Claude rejects the object form. Lets `/plugin marketplace add <repo>` + `/plugin install aegis@aegis` work. |
| `agents/<name>.md` | **Generated** `adapters/claude/agents/<name>.md`, via `plugin.json` `agents: ["./adapters/claude/agents/"]` | v0.0.5: new `agents` key replaces the default root scan; carries injected `tools:`. |
| `commands/<name>.md` | **Generated** `adapters/claude/commands/<name>.md`, via `plugin.json` `commands: ["./adapters/claude/commands/<name>.md", …]` | AG-0257: projected with flattened Claude-native frontmatter (`description` + `argument-hint`; canonical `kind`/`name`/`platforms`/`x-*` dropped). Declaring `commands` replaces the default `./commands/` scan. Before this, the raw canonical files were default-scanned and listed but **not invokable** (`/aegis:<cmd>` → "Unknown command"). |
| `rules/<name>.md` | Bundled into a bootstrap skill (delivered via SessionStart) | Plugin-root `CLAUDE.md` is NOT loaded by Claude — see Constraints. |
| `.claude-plugin/hooks/session-start.sh` | Plugin hook | Declared in `plugin.json` `hooks` field. |
| `adapters/claude/monitors/monitors.json` | Plugin monitors via `experimental.monitors` | **Opt-in (AG-0258):** not declared in the default `plugin.json`; ships the `aegis-cost` watcher for users who opt in. The context-window monitor was retired — see Background Monitors. |
| `templates/**` | NOT auto-loaded | Referenced via `${CLAUDE_PLUGIN_ROOT}/templates/...`; `${TEMPLATE:<family>}` now resolved in the generated tree (see Templates). |

## Generated-Tree Projection (v0.0.5)

Claude no longer discovers canonical surfaces in place. `scripts/project.mjs` runs a `projectClaude()` step that **generates a Claude-native tree** under `adapters/claude/` and regenerates `plugin.json` to point at it (DH1). The tree is **committed** (DH2) because Aegis installs via git spec with no build step on the user's machine — a gitignored tree would leave `plugin.json` pointing at non-existent files. `scripts/validate-structure.mjs` fails on any drift between canonical+manifest inputs and the committed tree (DH4), which is what makes committing safe.

```
adapters/claude/
  skills/<scope>/<name>/SKILL.md   ← generated from skills/<scope>/<name>/SKILL.md
                       abilities/  ← abilities/, references/, rules/ siblings copied verbatim
  agents/<name>.md                 ← generated from agents/<name>.md, with injected tools:
  commands/<name>.md               ← generated from commands/<name>.md (AG-0257), Claude-native frontmatter
  monitors/                        ← cost-watcher.sh, monitors.json (opt-in; AG-0258)
  statuslines/                     ← generated in v0.0.4; unchanged
```

**Per-skill / per-agent transform pipeline** (DH6, applied in order so later stages see resolved text):

1. Resolve `${TEMPLATE:<family>}` directives — Claude now runs the inline/Read branch it previously skipped.
2. Provider-tagged prose: keep `<claude>…</claude>` blocks, strip `<opencode>…</opencode>` and any other host's blocks.
3. **Re-inject the Invoke-via blockquote (Claude-only, v0.0.10 Phase F).** Canonical bodies are host-neutral — they no longer carry the `> **Invoke via …**` blockquote. The projector rebuilds it from `x-claude.primitiveHint` (`skill` → `Skill({skill: "aegis:<name>"})`, `agent` → `Agent({subagent_type: "aegis:<name>"})`) and PREPENDS it to the Claude body. Surfaces without `primitiveHint` get nothing; OpenCode/Codex/Cursor/Zed get nothing. `primitiveHint` is consumed here, never emitted into generated frontmatter.
4. Frontmatter: start from the canonical 5 fields → drop `kind`/`visibility`/`platforms`/`source` (not Claude-native) → flatten `x-claude.*` into native keys (`x-claude.paths` → `paths:`, `x-claude.agent` → `agent:`, `x-claude.disallowed-tools` → `disallowedTools:`) and strip the whole `x-claude`/`x-opencode` block → resolve the `model` alias via `manifest/models.json` → for agents, inject `tools:`/`disallowedTools:` from `manifest/permissions.json` (never from frontmatter).
5. Copy `abilities/`, `references/`, **and `rules/`** siblings verbatim so a SKILL.md's relative links (e.g. `python-developer`'s `rules/` sibling) resolve in the generated tree.
6. Atomic emit (`*.tmp` → `atomicReplace`).

The generated frontmatter may carry Claude-native keys the canonical files must never carry (`tools`, `disallowedTools`, `paths`, `agent`, resolved `model`); the validator allows those keys **only** on the generated side (DH3). Keys Claude does not support for plugin agents — `hooks`, `mcpServers`, `permissionMode` — are never emitted.

**Regression guard (DH5):** if the `claude` CLI is available at release, `claude plugin validate --strict` runs against the projected plugin. If not, that is an honest gap in Validation Evidence and the projector/validator fall back to mechanical guarantees: valid `plugin.json` JSON, every `skills`/`agents` path resolves, zero unresolved `${TEMPLATE:*}` tokens, every generated frontmatter parses with only allowed keys, and generated `tools:` matches `manifest/permissions.json` for every agent.

## Plugin Manifest Mapping

`.claude-plugin/plugin.json` declares `name`, `version`, `description`, `author`, `license`, `keywords`, the SessionStart hook, and — as of v0.0.5 — `skills` (repointed to the generated tree; as of AG-0256 one entry per **scope bucket root**, not per skill — Claude scans each entry one level deep for `<name>/SKILL.md`), `agents` (pointing at the generated agents dir), `commands` (AG-0257 — file-path array, generated tree), `userConfig`, and `dependencies`. Background monitors are **opt-in** and NOT declared in the default `plugin.json` (AG-0258 — see Background Monitors). Declaring an `agents` key **replaces** the default root `agents/` scan (per `references/claude-code-docs/docs/plugins-reference.md:600`), so canonical `agents/*.md` is no longer double-registered — the generated tree is the single discovered surface.

```jsonc
{
  "name": "aegis",
  "version": "0.0.5",
  "skills": ["./adapters/claude/skills/core/", "./adapters/claude/skills/languages/", "./adapters/claude/skills/workflows/"],
  "agents": ["./adapters/claude/agents/"],
  "userConfig": { "preferredLanguageOverlay": { "type": "string", "default": "" },
                  "telemetryOptIn": { "type": "boolean", "default": false } },
  "dependencies": [],
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|clear|compact",
        "hooks": [{ "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/.claude-plugin/hooks/session-start.sh" }]
      }
    ]
  }
}
```

## userConfig Install Prompts (v0.0.5)

`plugin.json` declares a `userConfig` block prompted at enable time:

- `preferredLanguageOverlay` (string, default `""`) — default language overlay skill to bias toward (e.g. `python-developer`).
- `telemetryOptIn` (boolean, default `false`) — opt-in for anonymous usage telemetry.

Values flow into `${USER_CONFIG_*}` substitutions exposed to skills and to monitor commands (`${user_config.*}`). This is **Claude-only** (DH7); OpenCode/Codex/Cursor/Zed have no equivalent and carry a `gap` row in `manifest/capabilities.json`.

## Background Monitors (v0.0.5; opt-in since AG-0258)

**Opt-in, off by default (AG-0258).** The default `plugin.json` does NOT declare `experimental.monitors`, so a fresh install fires **zero** background monitors. The `monitors.json` + watcher scripts ship in-tree for users who opt in by adding to their own settings:

```jsonc
"experimental": { "monitors": "${CLAUDE_PLUGIN_ROOT}/adapters/claude/monitors/monitors.json" }
```

`monitors.json` declares one watcher (Claude Code v2.1.105+, interactive CLI only):

- `aegis-cost` → `cost-watcher.sh` — warns when **estimated** session cost crosses budget bands (50/75/90%). Price/budget are env-overridable; every line is labelled "≈ est, not your bill".

**The context-window monitor was retired (AG-0258).** A monitor gets no session JSON (see below), so it tailed the transcript and computed usage % against a **hardcoded 200k ceiling** — which is wrong on 1M-context models (it reported 135% at ~271k tokens). The transcript carries no context-window limit and the model id lacks the `[1m]` marker, so a monitor **cannot** know the real ceiling. Accurate, self-adjusting context usage comes from the **statusline `context` segment**, which receives Claude's real `context_window.used_percentage` on the statusline stdin contract — use that instead.

### Honest contract (DH8) — monitors get NO session JSON

A Claude plugin monitor runs a command as a persistent background process; every stdout LINE it prints is delivered to Claude as a notification. It receives **only** env substitutions in its `command` (`${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, `${CLAUDE_PROJECT_DIR}`, `${user_config.*}`, environment vars). **It is NOT piped session JSON on stdin** — live context-window usage and session cost are exposed to the *statusline* contract, not to monitors.

So Aegis's cost watcher **tails the active session transcript JSONL** best-effort: they locate `~/.claude/projects/<slug>/` from `${CLAUDE_PROJECT_DIR}`, pick the most-recently-modified `*.jsonl`, `tail -F` it, parse `usage`/cost fields from assistant lines, and print one warning line per crossed threshold band. This couples to an **undocumented, unstable transcript location and shape** that may change across Claude Code versions.

**The failure mode is benign and advisory:** if the transcript can't be found or the format shifts, the watcher stays **silent — it never emits false data.** This is not a silent-failure-discipline violation (no hidden incorrect behaviour in a correctness path); it is an advisory aid that degrades to no-op, and the coupling is documented here. Note also that the cost figure is a **token-derived ESTIMATE, not the actual bill.** The `background-monitors` capability stays `claude: supported` for the *mechanism*; the transcript coupling is the documented caveat. Other hosts have no monitor primitive (`gap`).

## Plugin Dependencies Skeleton (v0.0.5)

`plugin.json` carries an empty `dependencies: []` array. The projector accepts an optional `manifest/dependencies.json` shape (absent today) so the v0.0.6+ split into `aegis-core` + `aegis-languages` can land without revisiting the projector. v0.0.5 ships as a single monolith, so the array is empty by design (`plugin-dependencies` capability is `partial`).

## `.skill` ZIP Distribution (v0.0.5)

`scripts/build-dist-zip.mjs` (Node, no deps) produces `dist/aegis.skill` — a reproducible ZIP of the projected Claude tree, loadable via `claude --plugin-url`. The build is deterministic (stable file order, zero mtimes, no `.DS_Store`), `dist/` is gitignored, and the build runs **on demand only**. This channel is **additive**: it coexists with the git-spec marketplace install paths below; both remain supported.

## Permissions (v0.0.5)

Agent permissions are projected from [`manifest/permissions.json`](../../manifest/permissions.json), the single agent-level trust boundary (read-only baseline, opt-in elevation):

- **Per-agent `tools:` allowlist** — injected into each generated `adapters/claude/agents/<name>.md` from the manifest's `claude.tools` for that agent (e.g. read-only reviewers get `["Read", "Grep", "Glob"]`; `ultra-worker` gets the full set incl. `Task`/`WebFetch`/`WebSearch`). Never sourced from canonical frontmatter (DH3).
- **Cross-cutting deny → PreToolUse hook** — Claude plugins cannot declare a plugin-level deny (`settings.json` accepts only `agent`/`subagentStatusLine`; no `plugin.json` `permissions` field — `references/claude-code-docs/docs/plugins-reference.md:809`), and agent `disallowedTools` filters the tool pool by bare name, not path/arg (`sub-agents.md:269,335`). So the manifest's `plugin.deny[]` (secret-file reads like `Read(./.env)`, `Read(~/.ssh/**)`, and destructive `Bash` like `rm -rf /`, `curl * | sh`) is enforced at runtime by the plugin **PreToolUse hook** `.claude-plugin/hooks/pre-tool-use-deny.sh` — the host's recommended mechanism for path/arg-scoped denial (`permissions.md:150-164`). The hook reads `plugin.deny[]` from the manifest at runtime and returns `permissionDecision:"deny"` on a match. `Task` is inert for plugin subagents (`sub-agents.md:306`), so the manifest's `Task` grants apply on OpenCode, not Claude.

See [`docs/agent-permissions.md`](../../docs/agent-permissions.md) for the full per-agent table and bucket definitions.

## Marketplace Entry

`.claude-plugin/marketplace.json` declares Aegis as a single-plugin marketplace named `aegis`. Users install via:

```bash
/marketplace add /path/to/aegis
/plugin install aegis@aegis
```

## Constraints (V — verified against `references/claude-code-docs/`)

- Plugin-root `CLAUDE.md` is NOT loaded by Claude. Aegis ships guidance via:
  - The SessionStart hook emits `hookSpecificOutput.additionalContext` with a bootstrap pointer.
  - A `core/using-aegis` skill body holds the canonical guidance (loaded on demand).
- Plugin-shipped agents lose `hooks`, `mcpServers`, `permissionMode`. Those go to settings layer if needed.
- Skills are namespaced `aegis:<skill-name>`; subagents `aegis:<agent-name>`.
- Paths in manifest must be relative, start with `./`, resolve under `${CLAUDE_PLUGIN_ROOT}`.
- Marketplace `name: aegis` is not on the reserved list (`anthropic-*`, `claude-*-marketplace`).

## Persistent Memory (v0.3.0)

`x-claude.memory: <scope>` (scope ∈ `user | project | local`) projects to native `memory:` in the
generated agent frontmatter. When enabled, Claude auto-injects the first 200 lines / 25 KB of
`MEMORY.md` into the subagent system prompt and auto-enables Read/Write/Edit. `project` is the
recommended default.

**Projection:** `scripts/project.mjs` `flattenXClaude()` emits `memory: <scope>` into
`adapters/claude/agents/<name>.md`. Scope is validated at projection time (invalid scope = hard fail).
OpenCode and Codex projectors do NOT emit `memory:` — it is a Claude-only field.

**cc-docs source (verified 2026-06-20, `references/claude-code-docs/docs/sub-agents.md §453-490`):**
When `memory` is enabled, Claude "auto-enables Read, Write, and Edit tools so the subagent can
manage its memory files." This is **unconditional** — the host injects Write/Edit regardless of
whether the agent's `tools:` allowlist mentions them. Therefore an agent's `tools:` allowlist
omitting Write is fine for memory; Write is auto-injected by the host, not by the plugin.

**Memory guard scope (D-01):** the projector guard catches an agent whose `disallowedTools`
**explicitly denies** Write or Edit — a hard denial that directly conflicts with the
auto-enable. The guard does NOT require Write to appear in the allowlist (auto-enable covers
that). Any agent locked `disallowedTools: [Edit, Write]` (all Aegis read-only reviewers) is
incompatible — the projector hard-fails if a memory-bearing agent's permissions disallow Write
or Edit. Memory does NOT go on read-only reviewers (`code-reviewer`, `code-quality-reviewer`,
`researcher`, etc.).

**Proof target:** `build-error-resolver` — RW-bash bucket, `Edit` permitted, no Write-disallow.
Its generated Claude frontmatter carries `memory: project`; OpenCode/Codex copies do not.

**Discipline:** `rules/memory-discipline.md` — observation taxonomy + curation + secret-scan gate.
**Retrieval:** `skills/core/recall` — 3-layer Read+Grep workflow over `MEMORY.md`, no MCP.

## Unsupported (Documented Gaps)

| Canonical concept | Claude native? | Strategy |
|---|---|---|
| Per-language overlays as runtime-conditional | Yes — `paths:` glob | **Supported as of v0.0.5** via `x-claude.paths` → native `paths:` (generated tree). |
| Statusline | Yes (`settings.json.statusLine`) | **Supported as of v0.0.4** — see Statuslines below. |
| Output styles | Yes (Claude-only) | Aegis stays format-neutral; not projected. |
| MCP servers | Yes | `gap` in `manifest/capabilities.json`; no MCP servers shipped from the plugin yet. |
| Memory decay / last-referenced scoring | No native primitive | Deferred — needs a store. If pursued, agent-maintained annotations in MEMORY.md (never a DB). |

## Statuslines (v0.0.4, revamped v0.3.6)

Statuslines are now supported on Claude — the headline host. `scripts/project.mjs` generates, per preset, `adapters/claude/statuslines/<preset>.mjs` (**9 preset descriptors + 9 generated shims**: `composable`, `cost-aware`, `essential`, `git-forward`, `gruvbox-dark`, `minimal-mono`, `token-budget`, `tokyo-night`, `verbose-hud`), a `<preset>.settings.json.snippet` (the `statusLine` block to paste into `settings.json`), and a shared `_subagent.mjs` variant for subagent contexts.

- **Runtime:** bulletproof Node, zero dependencies. Always exits 0, falls back to a bare `[Aegis]` line on any error, sanitizes stdin, and respects `COLUMNS`/`LINES` for width-aware truncation.
- **Install:** the `/aegis:statusline` slash command wires the chosen preset into the user's `settings.json`.
- **Themes:** `default`, `mono`, `gruvbox-dark`, `tokyo-night`, and the new **`hud`** theme (v0.3.6, used by `verbose-hud`).
- **`pr` segment:** reads Claude's native statusline JSON — `pr.{number,url,review_state}` plus `workspace.repo.{host,owner,name}` — with **no `gh` shell-out**.

### Tier-2 transcript reader (AG-0260, v0.3.6)

A second, opt-in detail tier reads the session's JSONL transcript for richer HUD segments. It is **gated**: the runtime only touches the file when the active descriptor includes at least one transcript-derived segment AND Claude's stdin payload carries `transcript_path`. The read is bounded (whole-file up to a size ceiling, trailing-window above it) and cached by resolved-path mtime+size, and — matching the bulletproof mandate — **degrades to a dropped segment on any parse failure**, never a crash and never a stale/wrong number. This is the deliberate transcript-coupling reopen the project previously avoided; the risk profile is lower than the retired context monitor because the failure mode is a blank segment, not a wrong one.

New/changed segments:
- `tools`, `agents`, `todos` — now **prefer** the transcript summary when present (richer detail: per-tool status/target, per-agent model/description/duration, in-progress todo text) and **fall back** to their original defensive stdin fields when the transcript is absent or ungated — no regression for existing presets.
- `task-banner` — new; renders the current in-progress todo as a short banner. Transcript-derived. Shipped but not currently used by any preset.
- The segment that echoed the last user prompt (sanitized, width-bounded; `verbose-hud`'s sole consumer) was retired in v0.3.10 (AG-0275) — the owner judged the truncated top line low-value. The underlying prompt extraction in `lib/transcript.mjs` is retained (unconsumed, reusable) but the segment module and its schema/validator registrations are gone.
- `claude-md` — new; counts CLAUDE.md/AGENTS.md context files from cwd up to the repo root plus the user-level file. **Filesystem-derived, not transcript-derived** — excluded from the transcript gate since it costs nothing extra to include.

### Honest segment gaps (known partial)

The `git`, `worktree`, and `prompt-cache` segments render **only** from documented statusline JSON fields. When the host doesn't surface that data, they emit nothing — there is **no subprocess fallback** (no `git` shell-out, no scraping). This is a deliberate known partial: segments are honest about missing data rather than spawning processes to fill gaps. `worktree` (AG-0268) renders only when `workspace.git_worktree` is present on stdin AND its value is DISTINCT from the branch `git.mjs` already renders (`worktree.branch` falling back to `workspace.git_worktree`); when the two values are identical it suppresses itself to avoid a duplicate line-1 entry (`⎇ x | 🌳 wt:x`).

## Templates (resolved v0.0.5)

Templates ship in the plugin tree and are readable at `${CLAUDE_PLUGIN_ROOT}/templates/...`. Skills reference template families via the `${TEMPLATE:<family>}` directive.

**Resolved in v0.0.5:** with the generated-tree projection, the skill-body transform now runs on Claude (pipeline step 2 above), so `${TEMPLATE:<family>}` directives are resolved in `adapters/claude/skills/`. The validator asserts zero unresolved `${TEMPLATE:*}` tokens across the generated tree (DH5). The v0.0.4 deferral is closed.

## Agent `@`-reference hotlinks (v0.0.13)

Three skeptical agents (`code-reviewer`, `code-quality-reviewer`, `doc-verifier`) hotlink the shared rule `@rules/skeptical-stance.md` instead of restating its full text, so the rule auto-inherits and drifts less when it changes. Claude **resolves** `@path` includes (the same mechanism as the `@./AGENTS.md` CLAUDE.md stubs), so the linked rule text is pulled in at load time — this is the host where the hotlink pays off. Each agent also keeps a one-line inline stance summary so non-resolving hosts (Codex/OpenCode/Cursor/Zed — see their `projection.md` gap rows) still carry the doctrine.

## Verification

```bash
# In Claude Code:
/marketplace add /path/to/aegis
/plugin install aegis@aegis
/skills           # Should show aegis:* skills
```

`claude plugin validate --strict .claude-plugin/` should pass before any merge that touches plugin manifest.

## Background-default + nesting cap (v2.1.198)

As of Claude Code v2.1.198, subagents dispatched via `Task`/`Agent` default to running in the **background** rather than blocking the parent turn, and the host enforces a fixed **5-level** subagent-nesting cap. This bears directly on the orchestrator / subagent-executor / ultra-worker fan-out doctrine: background-by-default changes how and when dispatched results arrive (poll/notify instead of an inline return), and the depth-5 ceiling bounds how deep a fan-out chain (orchestrator → subagent-executor → implementer → …) may nest before Claude refuses further dispatch. Prose note only — no projector or surface change.

## Hook capability matrix (v0.0.7, AG-0010)

Claude is the headline hook host. Every shipped portable hook intent projects to a
native Claude event binding. Judgment hooks (`prompt`/`agent` dispatch) are
Claude-only — keyed by `name` per D10. The scanner is opt-in (`enabled: false`).

| Intent / name | Status | Claude event → dispatch | Notes |
|---|---|---|---|
| `session-start` | supported | `SessionStart` → command | Bootstrap pointer via `additionalContext`. |
| `pre-tool-use-deny` | supported | `PreToolUse` → command | Path/arg-scoped deny from `manifest/permissions.json`. |
| `pre-compact` | supported | `PreCompact` → command | Captures decision/test anchors before compaction. |
| `post-compact` | supported | `PostCompact` → command | Restores the anchors after compaction. |
| `verify-no-secrets-touched` | supported | `PreToolUse` → prompt | LLM judgment gate; `{ok,reason}` contract. |
| `no-silent-failures` | supported | `PreToolUse` → prompt | Flags swallowed-error edits at write time. |
| `no-rationalization` | supported | `PreToolUse` → prompt | Flags rationalized skips on Bash calls. |
| `verification-before-completion` | supported | `PreToolUse` → agent | Ad-hoc verifier subagent (prompt, not agent-name, D4). |
| `instructions-loaded` | supported | `InstructionsLoaded` → command | Reports loaded-rule count + silent drops. |
| `file-changed` | supported | `FileChanged` → command | Advisory lint/format reminder per language overlay. |
| `cwd-changed` | supported | `CwdChanged` → command | Advisory directory-context note. |
| `prompt-injection-guard` | supported (opt-in) | `PreToolUse` → command | `enabled:false`; advisory scanner, excluded from the default `hooks` block (D7). Opt in via `.claude/settings.json`; see `docs/hooks.md`. |
