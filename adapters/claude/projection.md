# Claude Code Projection

**Status:** shipped. Headline host.

## Discovery Model (v0.1.3)

Aegis ships populated canonical `skills/`, `agents/`, `commands/` at the repo root
**and** declares `plugin.json` manifest keys pointing at the parallel generated
`adapters/claude/…` trees. Which one Claude Code actually loads depends on the install
path:

- **Marketplace install (`/plugin marketplace add` + `/plugin install`) — the only
  supported path (see `docs/getting-started.md`).** The `skills`/`agents`/`commands`
  manifest keys **replace** Claude's default root-folder scan. On Claude Code v2.1.140+
  this leaves one cosmetic side effect: an "ignored default folder" warning per root
  surface folder, since those folders exist but are not the declared scan target.
  Surfaces still load correctly from the generated tree — warning only, not a defect.
- **`--plugin-dir /path/to/aegis` — a maintainer footgun, never a documented user
  path.** Under `--plugin-dir`, the manifest keys **add to** rather than replace the
  default scan, so every canonical skill/agent/command double-loads alongside its
  generated `adapters/claude/…` counterpart. Do not use `--plugin-dir` to load Aegis;
  it exists in this doc only so a maintainer debugging with it understands the double-load
  is expected, not a bug to chase.

The manifest keys stay pointed at the generated tree (not canonical) because the Claude
projection is not a no-op — see "Generated-Tree Projection" below. Pointing Claude at
un-projected canonical would ship skills with unresolved `${TEMPLATE:*}` tokens, no
injected `tools:`/`memory:`, and no Invoke-via blockquote. See `adapters/AGENTS.md`'s Iron
Rule for why `adapters/claude/{skills,agents,commands}/` is a sanctioned generated
exception, not hand-copied canonical.

## What Claude Code Loads

| Aegis canonical | Claude native path | Notes |
|---|---|---|
| `skills/<scope>/<name>/SKILL.md` | **Generated** `adapters/claude/skills/<scope>/<name>/SKILL.md`; `plugin.json` `skills` lists the **bucket roots** `./adapters/claude/skills/{core,languages,workflows}/` | An earlier release repointed this to the generated tree. `skills` lists bucket roots, not the 82 per-skill dirs — Claude scans each entry one level deep for `<name>/SKILL.md` and *adds* to the default scan, so per-skill paths landed one level too deep and registered zero. |
| Marketplace | **Generated** `.claude-plugin/marketplace.json` (string `source: "./"`) | Claude's own marketplace, separate from Codex's `.agents/plugins/marketplace.json` (object source). Claude rejects the object form. Lets `/plugin marketplace add <repo>` + `/plugin install aegis@aegis` work. |
| `agents/<name>.md` | **Generated** `adapters/claude/agents/<name>.md`, via `plugin.json` `agents: ["./adapters/claude/agents/"]` | The `agents` key replaces the default root scan; carries injected `tools:`. |
| `commands/<name>.md` | **Generated** `adapters/claude/commands/<name>.md`, via `plugin.json` `commands: ["./adapters/claude/commands/<name>.md", …]` | Projected with flattened Claude-native frontmatter (`description` + `argument-hint`; canonical `name`/`visibility`/`platforms`/`x-*` dropped). Declaring `commands` replaces the default `./commands/` scan. Before this, the raw canonical files were default-scanned and listed but **not invokable** (`/aegis:<cmd>` → "Unknown command"). |
| `rules/<name>.md` | Bundled into a bootstrap skill (delivered via SessionStart) | Plugin-root `CLAUDE.md` is NOT loaded by Claude — see Constraints. |
| `.claude-plugin/hooks/session-start.sh` | Plugin hook | Declared in `plugin.json` `hooks` field. |
| `adapters/claude/monitors/monitors.json` | Plugin monitors via `experimental.monitors` | **Opt-in:** not declared in the default `plugin.json`; ships the `aegis-cost` watcher for users who opt in. The context-window monitor was retired — see Background Monitors. |
| `templates/**` | NOT auto-loaded | Referenced via `${CLAUDE_PLUGIN_ROOT}/templates/...`; `${TEMPLATE:<family>}` now resolved in the generated tree (see Templates). |

## Generated-Tree Projection

Claude no longer discovers canonical surfaces in place. `scripts/project.mjs` runs a `projectClaude()` step that **generates a Claude-native tree** under `adapters/claude/` and regenerates `plugin.json` to point at it (DH1). The tree is **committed** (DH2) because Aegis installs via git spec with no build step on the user's machine — a gitignored tree would leave `plugin.json` pointing at non-existent files. `scripts/validate-structure.mjs` fails on any drift between canonical+manifest inputs and the committed tree (DH4), which is what makes committing safe.

```
adapters/claude/
  skills/<scope>/<name>/SKILL.md   ← generated from skills/<scope>/<name>/SKILL.md
                       abilities/  ← abilities/, references/, rules/ siblings copied verbatim
  agents/<name>.md                 ← generated from agents/<name>.md, with injected tools:
  commands/<name>.md               ← generated from commands/<name>.md, Claude-native frontmatter
  monitors/                        ← cost-watcher.sh, monitors.json (opt-in)
  statuslines/                     ← generated; unchanged since introduction
```

**Per-skill / per-agent transform pipeline** (DH6, applied in order so later stages see resolved text):

1. Resolve `${TEMPLATE:<family>}` directives — Claude now runs the inline/Read branch it previously skipped.
2. Provider-tagged prose: keep `<claude>…</claude>` blocks, strip `<opencode>…</opencode>` and any other host's blocks.
3. **Re-inject the Invoke-via blockquote (Claude-only).** Canonical bodies are host-neutral — they no longer carry the `> **Invoke via …**` blockquote. The projector rebuilds it from `x-claude.primitiveHint` (`skill` → `Skill({skill: "aegis:<name>"})`, `agent` → `Agent({subagent_type: "aegis:<name>"})`) and PREPENDS it to the Claude body. Surfaces without `primitiveHint` get nothing; OpenCode/Codex/Cursor/Zed get nothing. `primitiveHint` is consumed here, never emitted into generated frontmatter.
4. Frontmatter: start from the canonical 4 fields → map `visibility: internal` → native `user-invocable: false` (**skills only**, see below), drop `visibility`/`platforms`/`source` (not Claude-native) → flatten `x-claude.*` into native keys (`x-claude.paths` → `paths:`, `x-claude.agent` → `agent:`, `x-claude.disallowed-tools` → `disallowedTools:`) and strip the whole `x-claude`/`x-opencode` block → resolve the `model` alias via `manifest/models.json` → for agents, inject `tools:`/`disallowedTools:` from `manifest/permissions.json` (never from frontmatter).
5. Copy `abilities/`, `references/`, **and `rules/`** siblings verbatim so a SKILL.md's relative links (e.g. `python-developer`'s `rules/` sibling) resolve in the generated tree.
6. Atomic emit (`*.tmp` → `atomicReplace`).

### `visibility: internal` → `user-invocable: false` (and why not `disable-model-invocation`)

Canonical `visibility: internal` marks a surface that other surfaces load but users should not
reach for directly. On Claude that projects to native `user-invocable: false`, which hides the
skill from the `/` menu while leaving both its description-in-context and model invocation intact
(`references/claude-code-docs/docs/skills.md:250`, invocation table at `:368`). `visibility: user`
projects nothing — Claude's default is already `user-invocable: true`.

**`disable-model-invocation: true` is the wrong mapping and must never be emitted.** It is the
tempting one: it *does* remove the skill from the `/` menu, and it *also* saves listing budget.
But the docs are explicit that it "prevent[s] Claude from automatically loading this skill"
(`skills.md:249`) and "removes the skill from Claude's context entirely" (`skills.md:584`); the
invocation table lists **Claude can invoke: No**. A parent skill could then no longer dispatch to
an internal child — `default-feature` → `implementation-planner` would break silently. The two
fields trade off exactly: one saves budget and severs dispatch, the other preserves dispatch and
saves nothing. Aegis needs dispatch, so it takes the field that buys **no listing-budget relief**.
Budget reduction comes from collapsing the surface, not from hiding it. `claude-drift`'s generated
skill-key allowlist admits `user-invocable` and deliberately omits `disable-model-invocation`.

**Gap — agent-level `visibility` has no Claude counterpart.** Subagent frontmatter has no
`user-invocable` field (`references/claude-code-docs/docs/sub-agents.md:275-290`), so the two
canonical agents marked `visibility: internal` (`code-quality-reviewer`, `spec-reviewer`) project
no visibility signal at all. Practically the field is near-vacuous for agents — subagents are
dispatched through the Agent tool and are never listed in the `/` menu — but the declaration is
honestly inert on this host rather than enforced, and is recorded here rather than silently
dropped.

The generated frontmatter may carry Claude-native keys the canonical files must never carry (`tools`, `disallowedTools`, `paths`, `agent`, `user-invocable`, resolved `model`); the validator allows those keys **only** on the generated side (DH3). Keys Claude does not support for plugin agents — `hooks`, `mcpServers`, `permissionMode` — are never emitted.

**Regression guard (DH5):** if the `claude` CLI is available at release, `claude plugin validate --strict` runs against the projected plugin. If not, that is an honest gap in Validation Evidence and the projector/validator fall back to mechanical guarantees: valid `plugin.json` JSON, every `skills`/`agents` path resolves, zero unresolved `${TEMPLATE:*}` tokens, every generated frontmatter parses with only allowed keys, and generated `tools:` matches `manifest/permissions.json` for every agent.

## Plugin Manifest Mapping

`.claude-plugin/plugin.json` declares `name`, `version`, `description`, `author`, `license`, `keywords`, the SessionStart hook, and `skills` (repointed to the generated tree; one entry per **scope bucket root**, not per skill — Claude scans each entry one level deep for `<name>/SKILL.md`), `agents` (pointing at the generated agents dir), `commands` (file-path array, generated tree), `userConfig`, and `dependencies`. Background monitors are **opt-in** and NOT declared in the default `plugin.json` (see Background Monitors). Declaring an `agents` key **replaces** the default root `agents/` scan (per `references/claude-code-docs/docs/plugins-reference.md:600`), so canonical `agents/*.md` is no longer double-registered — the generated tree is the single discovered surface.

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

## userConfig Install Prompts

`plugin.json` declares a `userConfig` block prompted at enable time:

- `preferredLanguageOverlay` (string, default `""`) — default language overlay skill to bias toward (e.g. `python-developer`).
- `telemetryOptIn` (boolean, default `false`) — opt-in for anonymous usage telemetry.

Values flow into `${USER_CONFIG_*}` substitutions exposed to skills and to monitor commands (`${user_config.*}`). This is **Claude-only** (DH7); OpenCode/Codex/Cursor/Zed have no equivalent and carry a `gap` row in `manifest/capabilities.json`.

## Background Monitors (opt-in)

**Opt-in, off by default.** The default `plugin.json` does NOT declare `experimental.monitors`, so a fresh install fires **zero** background monitors. The `monitors.json` + watcher scripts ship in-tree for users who opt in by adding to their own settings:

```jsonc
"experimental": { "monitors": "${CLAUDE_PLUGIN_ROOT}/adapters/claude/monitors/monitors.json" }
```

`monitors.json` declares one watcher (Claude Code v2.1.105+, interactive CLI only):

- `aegis-cost` → `cost-watcher.sh` — warns when **estimated** session cost crosses budget bands (50/75/90%). Price/budget are env-overridable; every line is labelled "≈ est, not your bill".

**The context-window monitor was retired.** A monitor gets no session JSON (see below), so it tailed the transcript and computed usage % against a **hardcoded 200k ceiling** — which is wrong on 1M-context models (it reported 135% at ~271k tokens). The transcript carries no context-window limit and the model id lacks the `[1m]` marker, so a monitor **cannot** know the real ceiling. Accurate, self-adjusting context usage comes from the **statusline `context` segment**, which receives Claude's real `context_window.used_percentage` on the statusline stdin contract — use that instead.

### Honest contract (DH8) — monitors get NO session JSON

A Claude plugin monitor runs a command as a persistent background process; every stdout LINE it prints is delivered to Claude as a notification. It receives **only** env substitutions in its `command` (`${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, `${CLAUDE_PROJECT_DIR}`, `${user_config.*}`, environment vars). **It is NOT piped session JSON on stdin** — live context-window usage and session cost are exposed to the *statusline* contract, not to monitors.

So Aegis's cost watcher **tails the active session transcript JSONL** best-effort: they locate `~/.claude/projects/<slug>/` from `${CLAUDE_PROJECT_DIR}`, pick the most-recently-modified `*.jsonl`, `tail -F` it, parse `usage`/cost fields from assistant lines, and print one warning line per crossed threshold band. This couples to an **undocumented, unstable transcript location and shape** that may change across Claude Code versions.

**The failure mode is benign and advisory:** if the transcript can't be found or the format shifts, the watcher stays **silent — it never emits false data.** This is not a silent-failure-discipline violation (no hidden incorrect behaviour in a correctness path); it is an advisory aid that degrades to no-op, and the coupling is documented here. Note also that the cost figure is a **token-derived ESTIMATE, not the actual bill.** The `background-monitors` capability stays `claude: supported` for the *mechanism*; the transcript coupling is the documented caveat. Other hosts have no monitor primitive (`gap`).

## Plugin Dependencies Skeleton

`plugin.json` carries an empty `dependencies: []` array. The projector accepts an optional `manifest/dependencies.json` shape (absent today) so a later split into `aegis-core` + `aegis-languages` can land without revisiting the projector. Aegis ships as a single monolith today, so the array is empty by design (`plugin-dependencies` capability is `partial`).

## `.skill` ZIP Distribution

`scripts/build-dist-zip.mjs` (Node, no deps) produces `dist/aegis.skill` — a reproducible ZIP of the projected Claude tree, loadable via `claude --plugin-url`. The build is deterministic (stable file order, zero mtimes, no `.DS_Store`), `dist/` is gitignored, and the build runs **on demand only**. This channel is **additive**: it coexists with the git-spec marketplace install paths below; both remain supported.

## Permissions

Agent permissions are projected from [`manifest/permissions.json`](../../manifest/permissions.json), the single agent-level trust boundary (read-only baseline, opt-in elevation):

- **Per-agent `tools:` allowlist** — injected into each generated `adapters/claude/agents/<name>.md` from the manifest's `claude.tools` for that agent (e.g. read-only reviewers get `["Read", "Grep", "Glob"]`; `ultra-worker` gets the full set incl. `Task`/`WebFetch`/`WebSearch`). Never sourced from canonical frontmatter (DH3).
- **Cross-cutting deny — not enforced (honest gap).** Claude plugins cannot declare a plugin-level deny (`settings.json` accepts only `agent`/`subagentStatusLine`; no `plugin.json` `permissions` field — `references/claude-code-docs/docs/plugins-reference.md:809`), and agent `disallowedTools` filters the tool pool by bare name, not path/arg (`sub-agents.md:269,335`). Aegis ships no runtime mechanism to work around this on Claude, so the manifest's `plugin.deny[]` (secret-file reads like `Read(./.env)`, `Read(~/.ssh/**)`, and destructive `Bash` like `rm -rf /`, `curl * | sh`) is advisory-only here — the per-agent `tools` allowlist is the real boundary. `Task` is inert for plugin subagents (`sub-agents.md:306`), so the manifest's `Task` grants apply on OpenCode, not Claude.

See [`docs/agent-permissions.md`](../../docs/agent-permissions.md) for the full per-agent table and bucket definitions.

## Marketplace Entry

`.claude-plugin/marketplace.json` declares Aegis as a single-plugin marketplace named `aegis`. Users install via:

```bash
/plugin marketplace add hyprtuna/aegis
/plugin install aegis@aegis
```

### `source: "./"` is load-bearing — do not change it casually

`marketplace.json` sets `"source": "./"`, which resolves to the marketplace root. That single value is
the only thing preventing every Aegis skill from registering twice.

Per `references/claude-code-docs/docs/plugins-reference.md:623`, the `skills` manifest key normally
**adds to** the default scan: *"The default `skills/` directory is always scanned, and directories
listed in `skills` are loaded alongside it."* Aegis has both a canonical root `skills/` tree and a
`skills` key pointing at the generated `./adapters/claude/skills/` tree, so the default behaviour would
register both copies of every skill. Aegis escapes it via the documented exception in the same line:
*"for a marketplace entry whose `source` resolves to the marketplace root, declaring specific
subdirectories replaces the default `skills/` scan."*

**Consequence:** changing `source` to anything that does not resolve to the marketplace root — a
`github` object entry, a subdirectory path — silently re-enables the default scan and double-registers
the entire skill corpus. The failure is quiet: no error, no warning, just duplicate skills competing in
the listing. If `source` ever must change, the `skills` key has to be re-derived at the same time.

### The `commands`/`agents` install notes are expected, not a defect

A freshly installed Aegis reports two entries in `claude plugin list` and the `/plugin` detail view:

```
Note: Default commands/ folder is ignored because the manifest sets "commands"
Note: Default agents/ folder is ignored because the manifest sets "agents"
```

Both are accurate and both are intended. Per `plugins-reference.md:622`, `commands` and `agents`
**replace** the default scan rather than adding to it, and per `:626` the host warns whenever a plugin
has both a default folder and the matching manifest key. Aegis's root `commands/` and `agents/` are
*canonical source* — they must never auto-load, or every surface would register twice. The ignore is
the correct outcome; the note is the host reporting it.

The suppression rule at `:626` (no warning when the manifest path points *into* the default folder,
e.g. `"commands": ["./commands/deploy.md"]`) cannot apply here, because Aegis's manifest points at
`./adapters/claude/`. Suppressing these notes therefore requires moving canonical source out of the
plugin-root folder names the host scans — tracked as a deliberate change, not a quick manifest edit.

## Constraints (V — verified against `references/claude-code-docs/`)

- Plugin-root `CLAUDE.md` is NOT loaded by Claude. Aegis ships guidance via:
  - The SessionStart hook emits `hookSpecificOutput.additionalContext` with a bootstrap pointer.
  - A `core/using-aegis` skill body holds the canonical guidance (loaded on demand).
- Plugin-shipped agents lose `hooks`, `mcpServers`, `permissionMode`. Those go to settings layer if needed.
- Skills are namespaced `aegis:<skill-name>`; subagents `aegis:<agent-name>`.
- Paths in manifest must be relative, start with `./`, resolve under `${CLAUDE_PLUGIN_ROOT}`.
- Marketplace `name: aegis` is not on the reserved list (`anthropic-*`, `claude-*-marketplace`).

## Persistent Memory

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
| Per-language overlays as runtime-conditional | Yes — `paths:` glob | **Supported** via `x-claude.paths` → native `paths:` (generated tree). |
| Statusline | Yes (`settings.json.statusLine`) | **Supported** — see Statuslines below. |
| Output styles | Yes (Claude-only) | Aegis stays format-neutral; not projected. |
| MCP servers | Yes | `gap` in `manifest/capabilities.json`; no MCP servers shipped from the plugin yet. |
| Memory decay / last-referenced scoring | No native primitive | Deferred — needs a store. If pursued, agent-maintained annotations in MEMORY.md (never a DB). |

## Statuslines (revamped for the Tier-2 HUD)

Statuslines are now supported on Claude — the headline host. `scripts/project.mjs` generates, per preset, `adapters/claude/statuslines/<preset>.mjs` (**9 preset descriptors + 9 generated shims**: `composable`, `cost-aware`, `essential`, `git-forward`, `gruvbox-dark`, `minimal-mono`, `token-budget`, `tokyo-night`, `verbose-hud`), a `<preset>.settings.json.snippet` (the `statusLine` block to paste into `settings.json`), and a shared `_subagent.mjs` variant for subagent contexts.

- **Runtime:** bulletproof Node, zero dependencies. Always exits 0, falls back to a bare `[Aegis]` line on any error, sanitizes stdin, and respects `COLUMNS`/`LINES` for width-aware truncation.
- **Install:** the `/aegis:statusline` slash command wires the chosen preset into the user's `settings.json`.
- **Themes:** `default`, `mono`, `gruvbox-dark`, `tokyo-night`, and the newer **`hud`** theme (used by `verbose-hud`).
- **`pr` segment:** reads Claude's native statusline JSON — `pr.{number,url,review_state}` plus `workspace.repo.{host,owner,name}` — with **no `gh` shell-out**.

### Tier-2 transcript reader

A second, opt-in detail tier reads the session's JSONL transcript for richer HUD segments. It is **gated**: the runtime only touches the file when the active descriptor includes at least one transcript-derived segment AND Claude's stdin payload carries `transcript_path`. The read is bounded (whole-file up to a size ceiling, trailing-window above it) and cached by resolved-path mtime+size, and — matching the bulletproof mandate — **degrades to a dropped segment on any parse failure**, never a crash and never a stale/wrong number. This is the deliberate transcript-coupling reopen the project previously avoided; the risk profile is lower than the retired context monitor because the failure mode is a blank segment, not a wrong one.

New/changed segments:
- `tools`, `agents`, `todos` — now **prefer** the transcript summary when present (richer detail: per-tool status/target, per-agent model/description/duration, in-progress todo text) and **fall back** to their original defensive stdin fields when the transcript is absent or ungated — no regression for existing presets.
- `task-banner` — new; renders the current in-progress todo as a short banner. Transcript-derived. Shipped but not currently used by any preset.
- The segment that echoed the last user prompt (sanitized, width-bounded; `verbose-hud`'s sole consumer) was retired in a later release — the owner judged the truncated top line low-value. The underlying prompt extraction in `lib/transcript.mjs` is retained (unconsumed, reusable) but the segment module and its schema/validator registrations are gone.
- `claude-md` — new; counts CLAUDE.md/AGENTS.md context files from cwd up to the repo root plus the user-level file. **Filesystem-derived, not transcript-derived** — excluded from the transcript gate since it costs nothing extra to include.

### Honest segment gaps (known partial)

The `git`, `worktree`, and `prompt-cache` segments render **only** from documented statusline JSON fields. When the host doesn't surface that data, they emit nothing — there is **no subprocess fallback** (no `git` shell-out, no scraping). This is a deliberate known partial: segments are honest about missing data rather than spawning processes to fill gaps. `worktree` renders only when `workspace.git_worktree` is present on stdin AND its value is DISTINCT from the branch `git.mjs` already renders (`worktree.branch` falling back to `workspace.git_worktree`); when the two values are identical it suppresses itself to avoid a duplicate line-1 entry (`⎇ x | 🌳 wt:x`).

## Templates (resolved)

Templates ship in the plugin tree and are readable at `${CLAUDE_PLUGIN_ROOT}/templates/...`. Skills reference template families via the `${TEMPLATE:<family>}` directive.

**Resolved:** with the generated-tree projection, the skill-body transform now runs on Claude (pipeline step 2 above), so `${TEMPLATE:<family>}` directives are resolved in `adapters/claude/skills/`. The validator asserts zero unresolved `${TEMPLATE:*}` tokens across the generated tree. The earlier deferral is closed.

## Agent `@`-reference hotlinks

Three skeptical agents (`code-reviewer`, `code-quality-reviewer`, `doc-verifier`) hotlink the shared rule `@rules/skeptical-stance.md` instead of restating its full text, so the rule auto-inherits and drifts less when it changes. Claude **resolves** `@path` includes (the same mechanism as the `@./AGENTS.md` CLAUDE.md stubs), so the linked rule text is pulled in at load time — this is the host where the hotlink pays off. Each agent also keeps a one-line inline stance summary so non-resolving hosts (Codex/OpenCode/Cursor/Zed — see their `projection.md` gap rows) still carry the doctrine.

## Verification

```bash
# In Claude Code:
/plugin marketplace add hyprtuna/aegis
/plugin install aegis@aegis
/skills           # Should show aegis:* skills
```

`claude plugin validate --strict .claude-plugin/` should pass before any merge that touches plugin manifest.

## Background-default + nesting cap (v2.1.198)

As of Claude Code v2.1.198, subagents dispatched via `Task`/`Agent` default to running in the **background** rather than blocking the parent turn, and the host enforces a fixed **5-level** subagent-nesting cap. This bears directly on the orchestrator / subagent-executor / ultra-worker fan-out doctrine: background-by-default changes how and when dispatched results arrive (poll/notify instead of an inline return), and the depth-5 ceiling bounds how deep a fan-out chain (orchestrator → subagent-executor → implementer → …) may nest before Claude refuses further dispatch. Prose note only — no projector or surface change.

## Hook capability matrix

Claude is the headline hook host. Every shipped portable hook intent projects to a
native Claude event binding. Judgment hooks (`prompt`/`agent` dispatch) are
Claude-only — keyed by `name` per D10. The scanner is opt-in (`enabled: false`).

| Intent / name | Status | Claude event → dispatch | Notes |
|---|---|---|---|
| `session-start` | supported | `SessionStart` → command | Bootstrap pointer via `additionalContext`. |
| `pre-compact` | supported | `PreCompact` → command | Captures decision/test anchors before compaction. |
| `post-compact` | supported | `PostCompact` → command | Restores the anchors after compaction. |
| `instructions-loaded` | supported | `InstructionsLoaded` → command | Reports loaded-rule count + silent drops. |
