# Changelog

All notable changes to Aegis are documented here.

This project follows [Conventional Commits](https://www.conventionalcommits.org) and [Semantic Versioning](https://semver.org).

## [Unreleased]

## [v0.3.10] — 2026-07-04

- **Review + authoring doctrine.** Fail-closed machine-parseable `verdict: PASS|FAIL` on the code-reviewer ReviewReport (CI gates read one field instead of parsing findings); QA-evidence-artifact convention (tested / observed / why-enough / omitted) in `verification-before-completion`; Fowler 12 code-smell baseline (heuristics — repo standards override) + tautological-test anti-pattern in the review/TDD skills; qualitative context-budget behavioral model (PEAK/GOOD/DEGRADING/POOR), closing the retired-monitor gap.
- **Prose denylist extended** — `moreover`, `furthermore`, `in summary`, `elevate`, `empower`, `underscore`, `pivotal` (warn); the em-dash ban was rejected (Aegis prose uses em dashes).
- **Statusline:** retired the `prompt-echo` segment — the truncated prompt top line is gone from `verbose-hud` (owner-requested); the `transcript.prompt` extraction is retained as reusable.

## [v0.3.9] — 2026-07-04

- **Statusline HUD alignment (verbose-hud).** Context/Usage/Weekly on one line with `|` separators (new optional per-descriptor `separator` glyph, default `·`, via `ctx.sep`); dropped the "resets in" prefix (reset times render as `(2h 10m)` / `(1d 19h)` from epoch `resets_at`).
- **All tool activity shown** — running (◐) + top-4-by-count completed (`✓/✗ name ×N`) + `+N more`, MCP names shortened, `|`-joined (per-tool status; a stale error no longer reddens the aggregate).
- **Agents one per line** — running (never dropped) + last-2-completed, max 3.
- **Worktree indicator** — `🌳 wt:<name>` on line 1, shown only when the worktree name is distinct from the branch git already shows (from stdin; no git subprocess).
- Every other preset renders unchanged (separator defaults to `·`; new segment opt-in).

## [v0.3.8] — 2026-07-03

- **Native subagent execution-profile primitives.** Project `effort`/`maxTurns`/`background`/`isolation` per-agent via the canonical `x-claude` path (validated+coerced through a new `scripts/lib/subagent-primitives.mjs`; mirrors the v0.3.0 `memory:` rollout). Applied `effort: high` to `code-reviewer` + `code-architect` and `isolation: worktree` to `code-simplifier`; projection-time isolation-requires-write guard; honest-gap notes for OpenCode + Codex.
- **Subagent doc reconciliation.** `/agents` wizard removal is UX-only (contract unchanged); `CLAUDE_CODE_SUBAGENT_MODEL` precedence note; Claude background-default + 5-level nesting cap documented.
- **Statusline fix.** `prompt-echo` now skips `<task-notification>` / `<system-reminder>` harness envelopes (owner-reported HUD leak).
- Third reference-refresh audit (2026-07-03, O-32..O-53) landed; O-35 deferred (watch).

## [v0.3.7] — 2026-07-03

Statusline HUD polish — three bug fixes found using the v0.3.6 verbose-hud HUD live. Statusline runtime + tests only; zero new surfaces.

### Fixed

- **prompt-echo no longer echoes harness markup.** Claude Code stores slash-command invocations (`<command-message>…<command-name>…`) and `<local-command-stdout>` blocks as `user` turns; the segment showed `"<command-message>aegis:statusline…"`. It now skips turns whose trimmed content starts with `<command-` / `<local-command-` and echoes the last genuine prompt — while a genuine prompt that merely *quotes* command markup is still shown (a `startsWith`, not substring, match).
- **Context bar is now labeled.** `context` and `context-detailed` render `Context <bar> <pct>`, matching `usage`'s `Usage`/`Weekly` labels (routed through `ctx.t("context")`, plain/uncolored).

### Changed

- **tools segment shows the most-recent tool, not the dominant one.** It previously rendered the highest-count tool (≈always `Bash`) colored by its most-recent status, so a single transient error reddened the whole `✗ Bash ×N`. It now shows the most-recently-used tool with its true current status (claude-hud's "current activity" model); the transcript summary's `tools` array is recency-ordered (most-recent last).

## [v0.3.6] — 2026-07-03

Statusline HUD redesign — brings the Node `.mjs` statusline runtime's
look in line with claude-hud's multi-line HUD, without adopting claude-hud's Bun/TS code (iron law).
Runtime + presets only; zero daemon/MCP.

### Added

- **Threshold-colored bars + reset timers**: a shared `renderBar`/`resolveBarColor`
  (`statuslines/_shared/lib/bar.mjs`, extracted from `context.mjs`) and a `formatReset()` relative-time
  formatter (`lib/reset-time.mjs`, epoch-unit auto-detected) upgrade `usage.mjs` to render
  `Usage <bar> 37% (resets in 2h 55m) · Weekly <bar> 62% (resets in 2d 10h)` from
  `rate_limits.{five_hour,seven_day}`, and harden `context.mjs` to fall back to a token-derived
  percentage when `used_percentage` is absent. New `hud` theme (teal/cyan accent, green→yellow→red
  gradient keys) validated against `statusline-theme.schema.json`.
- **Guarded Tier-2 transcript reader**: `lib/transcript.mjs` is a synchronous, bounded,
  mtime+size-cached JSONL reader pre-parsed once per invocation in `runtime.mjs` and attached as
  `ctx.transcript` — never parsed inside a segment's `render()`. Enriches `tools`/`agents`/`todos`
  with live transcript detail and adds three new segments: `prompt-echo` (last user prompt),
  `task-banner` (current in-progress todo), and `claude-md` (filesystem-derived CLAUDE.md/AGENTS.md
  count). All five degrade to a dropped (`null`) segment on any parse failure — this is a deliberate,
 recorded reopening of transcript-coupling that v0.3.5 retired for the context *monitor*;
  it is lower-risk here because a statusline segment degrades to blank on failure instead of emitting
  a wrong number.
- **`verbose-hud` full HUD**: the reference preset now composes the complete target
  layout — prompt echo, `[model] · dir` banner, threshold-colored context/usage bars, CLAUDE.md
  count, and enriched tools/agents/todos — on the `hud` theme.

### Changed

- **Lineup-wide preset revamp**: the other 8 presets adopt `thresholds` blocks for
  `context`/`usage` where they use those segments (bars are inherited automatically at the segment
  level); `minimal-mono`/`essential` stay restrained (mono, no gradient); theme-named presets
  (`tokyo-night`, `gruvbox-dark`) gained matching threshold keys in their theme files.
- **Claude projection notes + docs** updated for the new segments/theme and the honest Tier-2 gap
  posture on non-Claude hosts (statusline still Claude-only).

## [v0.3.5] — 2026-07-03

Plugin-discovery hardening, continued — two more Claude-plugin correctness bugs found while using the freshly-installed plugin. Projection/validator/docs only; zero runtime.

### Fixed

- **Slash commands now invoke**: `/aegis:statusline` (and the other 5 commands) were listed in the `/plugin` panel but returned "Unknown command". Commands weren't projected to a Claude-native tree — Claude default-scanned the raw canonical `commands/*.md`, whose non-native frontmatter (`kind`/`x-claude`/…) left them registered-but-not-invokable. Now `project.mjs` projects `adapters/claude/commands/<name>.md` with flattened Claude-native frontmatter and declares a `commands` array in `plugin.json` (mirroring `agents`). Skills count corrected 88→82 (commands no longer mis-counted as skills).
- **`argument-hint` no longer mistyped as an array**: `quoteIfNeeded` exempted flow-sequence-shaped scalars, so `argument-hint: [preset]` emitted unquoted and YAML re-read it as `['preset']`. Bracket-shaped hint strings are now quoted (2 commands + 2 skills).

### Changed

- **Background monitors are opt-in**: the default `plugin.json` no longer declares `experimental.monitors`, so a fresh install fires zero background monitors. The `cost` monitor ships in-tree for users who opt in; opt-in is documented in the Claude projection notes.
- **Context-window monitor retired**: it tailed the transcript and computed usage against a hardcoded 200k ceiling — wrong on 1M-context models (it reported 135% at ~271k tokens). A monitor gets no session data and cannot know the real ceiling; the statusline `context` segment already reports accurate, self-adjusting usage from Claude's own `context_window.used_percentage`. Its watcher script was deleted.
- **Validators**: `claude-drift` now covers the commands surface (path resolution, generated-listed parity, a Claude-native frontmatter key allowlist); `test-projection` asserts the command shape + quoted `argument-hint`.

## [v0.3.4] — 2026-07-02

Plugin-discovery hardening — fixes the Claude install, found while installing Aegis locally on Claude Code. Projection + validator only; zero runtime.

### Fixed

- **Claude install now works as documented**: `scripts/project.mjs` wrote the Claude marketplace (`.claude-plugin/marketplace.json`) in Codex object-`source` shape, so `claude plugin validate .` failed (`plugins.0.source: Invalid input`) and Aegis shipped no installable Claude marketplace. Split the emitter — Claude gets a string `source: "./"`, Codex keeps its object `{source, path}` at `.agents/plugins/marketplace.json`, OpenCode gets none (installs via `opencode.json`). One marketplace per host, no cross-host leak.
- **All skills register on Claude**: `.claude-plugin/plugin.json` listed `skills` as 82 individual skill directories, but Claude scans each `skills` entry one level deep for `<name>/SKILL.md` — so per-skill paths landed a level too deep and ~zero registered. Now `skills` lists the three scope bucket roots (`core`/`languages`/`workflows`); all 82 skills + 6 commands register (empirically verified via `claude plugin details`).

### Changed

- **`plugin-manifests` validator** enforces per-host marketplace `source` shapes: string-for-Claude (no `../` escape, no missing source), object-`{source,path}`-for-Codex; warns on an absent marketplace.
- **`claude-drift` validator** validates the bucket-root skills shape and adds a coverage guard — a scope bucket with skills on disk but missing from `plugin.json` now errors (previously a silent zero-registration false-negative).

## [v0.3.3] — 2026-07-02

Authoring + memory + permission doctrine. All declarative, editorial + one new skill; zero runtime.

### Added

- **`tool-param-permissions` rule** (`rules/tool-param-permissions.md`, documents Claude Code's native `Tool(param:value)` deny/ask permission-rule syntax — `Agent(model:opus)`, `Agent(isolation:worktree)`, `Bash(run_in_background:true)`, wildcard `Agent(model:*)` — as the daemon-free, iron-law-clean path to per-agent model/isolation gating. States the non-matchable-canonical-field boundary (`command`/`file_path`/`path`/`notebook_path`/`url` are excluded) and the iron-law contrast against the previously-rejected runtime spawn-interceptor. Guidance only — Aegis ships no permission preset by default.
- **`skill-extraction` skill** (`skills/core/skill-extraction`, the "skillify" counterpart to `skill-creation` — recognizes when a session's workflow is reusable and drafts a skill from it, gated by a 3-question quality gate (Google-in-5-min? / codebase-specific? / took real effort?). Hands off to `skill-creation` for scaffolding; encodes decision heuristics, not snippets.
- **Skill-authoring doctrine upgrade** (`skill-creation`, `skills/AGENTS.md`, grafts the `writing-great-skills` vocabulary (leading-words, completion-criterion, progressive-disclosure ladder, sediment/no-op/premature-completion failure modes) plus the tiered `SKILL.md` (<100 lines) / `REFERENCE.md` / `EXAMPLES.md` layout, formalizing the `abilities/` overflow pattern. Complements — does not duplicate — the existing "Match the Form to the Failure" table.
- **Memory-surface routing** (`rules/memory-discipline.md`, a "which store?" section routing a learning to durable `MEMORY.md` vs. the `AGENTS.md`/`CLAUDE.md` convention vs. ephemeral scratch, plus what NOT to store (duplicate/stale/derivable-from-code). Consistent with the v0.3.0 memory taxonomy and the `recall` skill.
- **Audit-correction doc hygiene** (`manifest/AGENTS.md`, `adapters/opencode/projection.md`, captures the v0.3.1 false-positive verification outcomes so future audits don't re-flag them — the deliberate all-`anthropic/claude`-on-every-host model-alias convention (`codex`/`opencode` columns mirror each other with an `anthropic/` prefix; the `claude` column is unprefixed), the verified-real OpenCode `experimental.chat.messages.transform` hook (`opencode-docs 18-plugins.md:317`), and a qualitative `fable`-tier cost caveat.

### Notes

- Surface counts: 82 skills / 17 rules / 17 agents / 6 commands.
- Strict review: fixes applied in-release (commit `f04e523`) — model-convention accuracy in `manifest/AGENTS.md`, a Claude-only host-scoping note added to `tool-param-permissions.md`, and the `fable` cost caveat softened from an unverifiable numeric multiplier to a qualitative premium-tier note.

## [v0.3.2] — 2026-06-21

Dynamic workflows / orchestration. All declarative, zero-runtime.

### Added

- **`github-coordination` skill** (`skills/workflows/github-coordination`): durable, zero-runtime multi-agent work-lock backed by GitHub issues — claim via `coordination:claimed` label + an owner-stamped `ecc.github.coordination.v1` JSON block in the issue body; decompose + unblock via `gh` only. Carries the TOCTOU caveat (two concurrent claims can both pass the unclaimed check) and cross-references the "serialize write subagents" rule. Pairs with `github-workflow`. Honest gap: GitLab equivalent deferred.
- **`scratch-dir-convention` rule** (`rules/scratch-dir-convention.md`): the self-ignoring scratch dir pattern (`mkdir -p .aegis-scratch && printf '*\n' > .aegis-scratch/.gitignore`) — one-shot, stateless, no runtime. Explicit anti-pattern: never instruct a subagent to write under `.git/` (Claude Code denies agent writes to that protected path, breaking file-handoff silently). Wired into `dispatching-parallel-agents`, `subagent-execution`, `autonomous-execution`, and `orchestrator-guide`.
- **Delivery-vs-research work-shape fork** in `autonomous-execution`: a gate at the top of the loop forks delivery-shape (QA/cleanup/commit apply) from research-shape (skip QA/cleanup/commit; keep source-observability + evidence discipline). Append-only `HYPOTHESIS[id]: claim | status: open→confirmed/refuted` ledger — entry flipped only on an observed primary source; never re-investigate an answered question. De-duplicated against `research`/`researcher`/`evidence-before-assertion`.
- **File-handoff hygiene + progress-ledger rules** in the orchestration cluster (`orchestrator-guide`, `dispatching-parallel-agents`, `subagent-execution`): hand briefs/diffs as files (never paste — pasted text stays controller-resident for the whole run); never `HEAD~1` in dispatch prompts (use explicit SHAs — moving refs drift as commits land); durable append-only progress ledger so a compacted controller doesn't re-dispatch completed tasks. Verified non-duplicating against existing surfaces.

### Notes

- Surface counts: **81 skills / 16 rules**.
- Strict review: 0 critical / 0 high / 2 medium / 3 low; M1/M2/L1/L3 fixed in-release (commit `bed1d4a`); L2 (pre-existing `autonomous-execution` / "Ultra Worker" identity drift) deferred →

## [0.3.0] — 2026-06-21

Persistent memory surface — thin, native-primitive-backed. **Content + one frontmatter projection, zero runtime** (no daemon, MCP server, SDK extractor, vector store, or SessionStart auto-load — iron law).

### Added

- **`x-claude.memory` projection**: a canonical agent's `x-claude.memory: user|project|local` projects to the host-native `memory:` field in the generated Claude agent frontmatter (Claude auto-injects the first 200 lines/25 KB of `MEMORY.md` + auto-enables Read/Write/Edit for memory management — cc-docs verified). Scope-validated (invalid scope hard-fails); a projection guard rejects `memory` on an agent with an explicit `disallowedTools: [Write|Edit]`. Applied to `build-error-resolver` (`memory: project`) to remember recurring build-error → fix patterns.
- **`recall` skill** (`skills/core/recall`): token-economical 3-layer retrieval over `MEMORY.md` — index (grep) → already-injected context window → fetch (Read) — **Read + Grep only, no MCP**.
- **`memory-discipline` rule** (`rules/memory-discipline.md`): observation taxonomy (`discovery|decision|blocker|progress|bugfix|change`; entry shape `title/facts/narrative/concepts/files`) + curation discipline (preserve-exactly code/paths/commands/versions, compress only prose; promote recurring; supersede contradictions) + a secret-scan *discipline* (never write secrets/PII to memory).

### Notes / honest gaps

- **Claude-only.** Non-Claude hosts have no native subagent memory → fallback: a plain `.aegis-memory/MEMORY.md` read by the host-neutral `recall` skill (Read+Grep work everywhere). Memory-bearing agent instructions reference that fallback so they're actionable on every host.
- **Decay deferred** (needs a store; if pursued, agent-maintained "last-referenced" annotations, never a DB).
- The secret-scan memory discipline is a model-followed convention — **no automated enforcement** at the runtime write boundary (MEMORY.md lives in host-managed agent-memory dirs, outside repo scans).
- Surface counts: 80 skills, 15 rules.

## [0.2.2] — 2026-06-20

Codex-cohort follow-ons.

### Added

- **Subagent skill preload**: `x-claude.skills` on a canonical agent projects to the host-native `skills:` field in the generated Claude agent frontmatter, preloading a paired skill's content into the subagent at startup (honored for plugin-loaded subagents per cc-docs). Applied to `code-reviewer` (preloads `code-review`) and `researcher` (preloads `research`); unknown skill names fail at projection time.

### Changed

- **OpenCode compaction docs corrected**: the `experimental.session.compacting` shape is now documented (`input {sessionID}` → `output {context: string[], prompt?}`), so the adapter no longer calls it "unverified"; the real gap is restated precisely (no pre/post phase split). `autocontinue`, `permission.ask`, and `chat.system.transform` were each evaluated and **deferred with rationale** (no Aegis use-case / under-documented input shape / needs a controlled test — and no OpenCode runtime to verify here). The no-op compaction bridge signature was corrected to the verified API shape.

### Reconciled (not shipped)

-s `x-claude.model`/`fallbackModel` half was **reconciled to D3, not introduced**: per-agent authoring-time model is already the sole responsibility of `manifest/permissions.json` (D3 single-source — projected + honored for plugin subagents). A second `x-claude.model` source would conflict (canonical would declare one model while permissions ships another), so it was rejected and a hard-fail guard in `flattenXClaude` prevents its re-introduction.

## [0.2.1] — 2026-06-20

Codex hooks projection — the v0.2.0 D-03 follow-on.

### Added

- **Hook intents now project to Codex** (`hooks/hooks.json`). New `x-codex` binding on the 4 mappable intents (SessionStart, PreToolUse=the deny guard, PreCompact, PostCompact) + a `projectCodexHooks` emitter that writes `.codex/plugins/aegis/hooks/hooks.json`, bundles the (verified Claude-compatible) hook scripts, and wires the manifest `hooks` pointer. The deny script now resolves its `permissions.json` config script-relative (config bundled into the plugin) with the `${CLAUDE_PLUGIN_ROOT}` path as a fallback, so Claude is unaffected and fail-open is preserved. **Install-verified** against codex 0.141.0 (plugin installs with valid hooks JSON; clean session).
- **CODEX-validator drift gate**: the bundled `.codex/plugins/aegis/hooks/permissions.json` + hook scripts must byte-match their sources, so a stale Codex deny config can't ship silently.

### Notes / honest gaps

- The v0.2.0 "scripts incompatible" deferral premise is **withdrawn**: Codex's PreToolUse contract mirrors Claude's (`tool_name`/`tool_input` + `hookSpecificOutput.permissionDecision`).
- **Runtime fire-and-deny test is pending interactive Codex verification** (owner-run): `codex exec` does not fire plugin hooks, so the actual blocking behavior can only be confirmed in an interactive Codex session. Contingency tracked: if interactive Codex requires `exit 2` to deny, add a Codex exit-2 branch (D-03).
- No Codex event for `CwdChanged`/`FileChanged`/`InstructionsLoaded` → honest gaps; the 5 `enabled:false` judgment hooks are excluded.

## [0.2.0] — 2026-06-20

Codex adapter modernization. The Jan-2026 assumptions Aegis's Codex
projection was built on were obsolete; this release verifies the **current**
Codex contract against official docs **and the live `codex 0.141.0` CLI**, and
fixes the projection to match. The previous Codex output did not actually install
as a plugin; it now does (live-verified end-to-end).

### Fixed

- **Codex plugin now installs.** Reworked the projection to the official plugin layout: a self-contained plugin root at `.codex/plugins/aegis/` with `.codex-plugin/plugin.json` (carrying `skills`/`mcpServers` pointers + `keywords`), plugin-root `skills/`, and `.mcp.json`; plus a marketplace at `.agents/plugins/marketplace.json` (canonical) and `.claude-plugin/marketplace.json` (legacy) using the **object** `source` form. The prior string-`source` form failed `codex plugin add`. **Live-verified:** `codex plugin add aegis@aegis` → installed/enabled, and `codex exec` discovers the Aegis skills (D-04/D-05/D-06).

### Removed

- **The bogus 8 KB per-body Codex skill cap** (closing the deferral). It was an unsourced guardrail targeting the wrong thing: the real Codex budget is ~8,000 characters on the aggregated skills *list* (names + descriptions), not per-body, and the full SKILL.md body is read with no truncation. Removed from `project.mjs`, `validate/codex.mjs`, the `skill-codex-cap` rule, and all docs.

### Changed

- **`native-tool-contracts.md` + `adapters/codex/projection.md` corrected** to the verified contract: `[features] multi_agent` is stable/on (no stable `multi_agent_v2`), interactive subagent spawn is model-orchestrated, `plugin_hooks` removed (hooks unified under `[features] hooks`).

### Honest gaps recorded (verified, not silently dropped)

- **Native subagents** (`.codex/agents/*.toml`) are **not plugin-distributable** — Codex plugins have no `agents` manifest pointer (D-02, reversed on evidence). Agents continue to ship folded into skills (runtime-verified). A plugin can't deliver native subagents.
- **Hooks projection deferred to v0.2.1.** Codex supports plugin hooks and 4 Aegis intents map cleanly, but the Aegis hook *scripts* emit Claude's nested `hookSpecificOutput` deny shape while Codex needs a top-level `permissionDecision` + exit 2 — shipping as-is would silently break the deny hook. Needs host-specific Codex scripts + a live fire-and-deny test.

## [0.1.2] — 2026-06-20

Policy + ergonomics, from two owner directives.

### Changed

- **Emoji are allowed when they serve a purpose**. Removed the emoji half of `scripts/unicode-safety-scan.sh`; the Trojan-Source security check (zero-width / bidirectional Unicode, scanned across all surfaces) is fully retained. Restored the `⚠️ Cannot verify from diff` reviewer verdict marker that v0.1.1 had been forced to replace with a plain token. Docs updated to the purposeful-emoji policy.
- **The Codex 8 KB skill-body cap is now warn-only, not a build error**. An investigation found it to be an unsourced Aegis guardrail, not a documented Codex limit (see `.aegis/research/codex-8kb-cap.research.md`) — the "Codex truncates at runtime" claim was unverified, likely cross-contaminated from a Claude Code doc. The projector now warns and still projects on overflow; the validator emits a warning, not an error. Fixed the broken escape hatch (the `references/` exemption was gitignored/uncommittable — `abilities/` now also exempts). The `8192` threshold is retained as a leanness budget; the final keep/raise/remove decision is deferred to which will vendor real Codex docs and can test truncation empirically.

## [0.1.1] — 2026-06-20

Authoring-doctrine uptake — the 2026-06-14 reference-refresh audit's three content
rewrites (O-5, O-9/O-14, O-10), carved out of the combined v0.1.0 for focused
strict review. All content; no infra, schema, or new validators.

### Changed

- **`skill-creation` rewritten to current conventions**: removed stale Anvil-era frontmatter (`group`/`trigger`/`preferred_model`/`chains`/`isHidden`), the removed `aegis skill list` CLI, `src/core/types.ts`, and the non-existent `skills/universal/` path; folded in superpowers' "Match the Form to the Failure" selection table + the "Micro-Test the Wording" method (pinned `writing-skills-composition-doctrine @9887c17`).
- **`implementation-planner` gains Global Constraints + Interfaces**: a top-level `## Global Constraints` section + per-task `**Interfaces:**` (Consumes/Produces) in both the markdown plans template and the structured-slate `executable_plan` schema; states "reference the spec, don't restate it" reconciled with the No-Placeholders rule; adds the Task Right-Sizing test (pinned `writing-plans-crisp @9d2b0e97`).
- **Reviewer-dispatch doctrine hardened**: `two-stage-review` + `code-reviewer` gain attention-lens (copy spec constraints verbatim), anti-pre-judging, don't-trust-the-report (a rationale never downgrades severity), and a third `CANNOT_VERIFY` verdict for unchanged-code/cross-task requirements; the model table gains "always specify the model explicitly" + "turn count beats token price"; `review-response` gains one-commit-per-concern. Two-stage architecture unchanged (pinned `sdd-review-dispatch @420c234`).

### Notes

- The superpowers `⚠️` third-verdict symbol ships as the text token `CANNOT_VERIFY` to honor Aegis's no-emoji-in-guidance rule.
- `implementation-planner` and `code-reviewer` sat at the Codex 8 KB skill-body cap; the rewrites deduped restated content into ability fragments to fit (the `references/` cap escape hatch is gitignored and unusable). See the known-gap note in the v0.1.1 plan.

## [0.1.0] — 2026-06-14

Release-workflow doctrine, the 2026-06-14 reference-refresh audit uptake, and
1.0 user-facing docs. **No contract freeze** — the plugin surface stays
intentionally flexible while host tooling evolves. HTML template coverage
(20/20) and the render harness shipped in v0.0.8; this release adds the process,
hardening, and docs around them.

### Added

- **Release-workflow doctrine** (`docs/release-workflow.md` + `AGENTS.md` summary): the full ship pipeline (pre-flight → branch/worktree → per-ticket plan/code/gate loop → release-granularity strict review → ship), the 1-default/2-ceiling concurrency cap, sole-arbiter git discipline, the `gh`-merge-from-worktree 3-step split, and an explicit per-release tag step.
- Model aliases `fable` (Claude Fable 5) + `best` in `manifest/models.json`.
- `AGENT_PLUGIN_DROP` validator — warns on `x-claude.{hooks,mcpServers,permissionMode}`, which Claude silently drops for plugin-loaded subagents.
- Protected-branch git-guard in the PreToolUse deny hook — blocks commit/push to protected branches plus force-push / `reset --hard` / `restore` / `clean`, driven by `manifest/permissions.json` `plugin.gitGuard`, fail-open with an auditable override.
- Hook-authoring hardening doctrine (`hooks/AGENTS.md`) + `AEGIS_DISABLE` / `AEGIS_SKIP_HOOKS` skip-guards on the lifecycle hooks (the deny hook is intentionally exempt).
- MCP connector policy (`docs/mcp-policy.md`) + capability-surface-selection tree (`docs/architecture.md`).
- Two security scanners — `unicode-safety-scan.sh` (zero-width/bidi + emoji) and `personal-paths-scan.sh`; the security set is now five.
- UI empirical-validation rule + three sharpened anti-pattern lines.
- 1.0 user-facing `README.md` and `docs/getting-started.md` rewrites; new `docs/templates-gallery.md` covering the 22 HTML templates.
- 2026-06-14 reference-refresh audit + research notes (ECC, agentmemory, claude-mem); tickets

### Changed

- **Dropped the planned v0.1.0 contract freeze.** The surface stays flexible; no frozen `CONTRACT.md`, no `BREAKING-CHANGES.md` deprecation gate.
- Roadmap re-scoped: v0.3.0 memory surface re-anchored on the native subagent `memory` primitive (effort L→M); v0.2.0 gains Codex adapter modernization.
- Emoji removed from `framework-selection`, `read-background-results`, and the `orchestrator` agent (no-emoji discipline, enforced by the new unicode scanner).
- GSD reference pointer re-pointed to `open-gsd/gsd-core` (upstream moved).

## [0.0.14] — Progressive Disclosure + UX Polish

The P2/P3 polish cluster — the last release before the v0.1.0 contract freeze. Additive
only; no new surface kinds, no breaking shapes.

### Added

- `SKILL_SIZE` validator: the >100-line `SKILL.md` body cap (warn-only; 25 skills remain
  the backlog). Replaces the duplicate body-length check formerly in `SKILL_BODY_LONG`
  (now description-length only) — exactly one size warning per oversize skill.
- Skill **intensity levels**: optional `x-aegis.intensity` (`lite`/`full`/`ultra`, implicit
  `full`) extending the v0.0.13 composition metadata; validated by `composition.mjs`. Applied
  to `code-review`, `research`, `code-simplification`.
- `scripts/template-query.mjs` — maintainer-only introspection over the template index
  (`--kinds-supporting`, `--formats`, `--slots`, `--list`; JSON output).
- Statusline composability: additive theme-schema support for element ordering, merge-groups,
  threshold escalation, and i18n (all existing configs remain valid); a `composable/` preset.

### Changed

- **Progressive disclosure:** the 4 largest oversize skills (`sdd-workflow`,
  `two-stage-review`, `verification`, `using-git-worktrees`) restructured into lean
  `SKILL.md` (nav + when-to-use + forks + pointers) ≤100 lines + unregistered `abilities/`
  overflow — no content dropped. The remaining 25 are the documented warn-only backlog.
- **HTML UX patterns:** normalized 13 slot keys to camelCase across the HTML + Markdown
  families (slot↔body gate stays green); added scroll-margin anchors, `<details>`
  collapsibles, accent borders, and eyebrow/subtitle to the producer-backed HTML templates
  (render harness asserts the markers).

## [0.0.13] — Composition + Workflow Patterns

Wires the audit's compounding-value cluster: declarative composition metadata, a gated
workflow convention, the two-stage review loop, discipline hard-gates, a SessionStart
bootstrap, self-review checklists, the decision tri-partition, and agent rule-hotlinking.
Builds on v0.0.11's `skills/workflows/` cohort + v0.0.10's review consolidation.

### Added

- `x-aegis.pipeline` composition metadata (`requires`/`handoff`/`next`, all optional) +
  the `COMPOSITION` validator (warn-only): builds the composition graph, asserts acyclic,
  every referenced skill exists, every handoff is a real template kind or `// REASON:`.
  Seeded on the composing skills (current names only).
- Phase-ordered gated-workflow convention documented in `docs/workflow-guide.md` and applied
  to the `skills/workflows/` cohort (each phase gates on the prior; named `next`; forward-on-
  pass / back-on-fail).
- `<HARD-GATE>` + concrete GOOD/BAD blocks on `test-driven-development`, `verification`,
  `debugging`.
- Pre-handoff self-review checklists on `implementation-planner`, `brainstorm-spec`, `research`.
- Decision **Locked / Deferred / Discretionary** tri-partition in the `decisions` template
  (+ a `status:` field in the spec template's inline decisions block).

### Changed

- Two-stage review loop (spec-compliance → code-quality, **fail-loops-back**) wired into
  `sdd-workflow` + `default-feature`, routed through the `two-stage-review` skill over the
  consolidated `code-review` instrument (internal stage reviewers are dispatch targets, not
  public agents).
- The existing SessionStart hook now injects a concise `using-aegis` bootstrap (discovery
  doctrine + top-surface index) — extended, not duplicated.
- The 3 skeptical agents (`code-reviewer`, `code-quality-reviewer`, `doc-verifier`) hotlink
  `@rules/skeptical-stance.md` instead of restating it (Claude resolves the include; the
  OpenCode/Codex/Cursor/Zed no-resolution gap is documented per host; an inline summary is
  kept so the doctrine survives on non-resolving hosts).

## [0.0.12] — Validator + Agent-Safety Hardening

Lands the audit's P0 cluster (trigger-phrase lint, stale-count/dead-link validator,
agent-safety metadata) plus the skeptical-stance formalization and slot↔body
hardening — all riding the shared single-walk ctx under the <30s ceiling.

### Added

- `TRIGGER_PHRASE` validator (warn-only): every skill/agent `description` should carry a
  "Use when…" trigger clause. Graduates to hard-fail in v0.0.13. ~20 warn-only hits today.
- `DOC_DRIFT` validator: surface-count drift (hard-fail) against README + root AGENTS.md +
  docs/architecture.md + `.claude-plugin/plugin.json`; broken `references/`/repo-internal
  markdown links (error). Caught + fixed 7 pre-existing broken links in two UI skills.
- `STANCE` validator (warn-only) + `rules/skeptical-stance.md` + `x-aegis.stance: skeptical`
  on `code-reviewer`, `code-quality-reviewer`, `doc-verifier` — the skeptical-by-default
  opt-in is now a named, validator-checked pattern.
- Per-agent `claude.model` + `claude.disallowedTools` across all 17 agents in
  `manifest/permissions.json` (the single source of truth): opus for code-architect /
  code-reviewer / mcp-builder / ultra-worker, haiku for code-explorer, sonnet for the rest;
  `[Edit, Write]` disallowed on the 11 read-only agents. Projected to Claude agent
  frontmatter (`model:`/`disallowedTools:`) + OpenCode `permission` deny rows;
  `validate-permissions.mjs` enforces model+disallow coverage + bidirectional drift.

### Changed

- `template-index.mjs` slot↔body check tightened to **full-path correspondence**:
  a bogus dotted sub-path of a scalar slot now errors; HTML/MD shape arrays are required to
  appear in the body. The two HONEST-GUARANTEE false-negatives are closed.
- Unified the slot-declaration convention; migrated 22 manifests; extracted the shared HTML
  SLOT-key regex (now includes `-`) + body skip-list into `scripts/validate/_context.mjs`,
  consumed by both `template-index.mjs` and the render harness (no more divergence).

## [0.0.11] — Naming Migration + Workflow Taxonomy

Applies the audit §2 Rename/Merge Table as coordinated transactions, documents the
review-cluster hierarchy, promotes the multi-phase skills into `skills/workflows/`, and
writes the SKILL/COMMAND/WORKFLOW guide. Runs after v0.0.10's consolidation; renames the
survivors only. No template wiring (§3), no further dedup (§6).

### Changed (renames — each a coordinated multi-site transaction)

- `orchestration` → `parallel-wave-executor`
- `skill-orchestration` → `skill-router-gate`
- `brainstorming` → `design-exploration`
- `planning` → `task-decomposition`
- `plan-writing` → `implementation-planner`
- `plan-verification` → `plan-structure-audit`
- `feature-development` → `feature-developer`
- `development` → `general-developer`

Each updated all touch-sites in lockstep (skill dir, frontmatter `name`, self-refs,
cross-skill prose, the skill-router-gate routing table, agent pairings). Template kinds
(`plans`, `decisions`) were untouched — they are not skill names.

### Merged

- `slop-removal` skill → `skills/core/code-simplification/abilities/slop-removal.md` (an
  unregistered on-demand ability per Iron Law 4; full body preserved, standalone skill
  removed; `code-simplification` references it).

### Moved (workflow taxonomy promotion)

- Promoted 7 multi-phase skills `skills/core/` → `skills/workflows/`: `sdd-workflow`,
  `feature-developer`, `design-exploration`, `learning`, `debugging`, `security-auditing`,
  `codebase-onboarding`. Taxonomy stays `core / languages / workflows` (no new tier).

### Documented

- Review-cluster hierarchy: `code-review` is the **instrument**; `review-requesting`,
  `review-response`, `two-stage-review` are **workflows that call it** (no renames).
- New `docs/workflow-guide.md`: the SKILL vs COMMAND vs WORKFLOW decision rule (with
  `code-review`=skill, `pr`=command, `default-feature`=workflow), the review-cluster
  hierarchy, and "why Aegis exports skills, not workflow templates."

## [0.0.10] — Surface Dedup + Hygiene

Cuts dead weight the surface audit (§1, §6) exposed — single-skill wrapper commands,
a four-way review-agent cluster, broken pairings, overlapping discipline rules, an
undocumented hook enum — and relocates the invocation-hint boilerplate. Dedup/hygiene
only; no skill renames (those are v0.0.11).

### Removed

- 8 single-skill wrapper commands (`debug`, `discuss`, `explore`, `new-skill`,
  `select-skill`, `tdd`, `start-research`, `review`). Surviving command set is the 6
  meta-utilities: `pr`, `skill`, `skill-pin`, `skill-unpin`, `skill-search`, `statusline`.
- `agents/strict-reviewer.md` — folded into `code-reviewer --strict` (its full
  adversarial lock-in / irreversible-decision lens + `min_confidence: 0` preserved).

### Changed

- One public reviewer: `code-reviewer` gains documented `--type` (spec-compliance|
  code-quality|both) + `--strict` modes; `spec-reviewer` + `code-quality-reviewer`
  demoted to `visibility: internal` (Stage 1/2 dispatch targets). `subagent-executor`
  / `orchestrator` strict-review dispatch repointed to `code-reviewer --strict`.
- Each deleted command's `x-claude.argument-hint` migrated into its paired skill.
- The `> **Invoke via …**` blockquote relocated from canonical bodies to an
  `x-claude.primitiveHint` field; the projector re-injects it on Claude only
  (canonical bodies are now host-neutral; OpenCode/Codex bodies carry no blockquote;
  `primitiveHint` is consumed-not-emitted).

### Documented

- `researcher` agent ↔ `research` skill pairing (vs `deep-diving` = data-flow trace);
  `build-error-resolver`/`code-architect`/`code-explorer` as sanctioned agent-only;
  `slop-removal` vs `code-simplification` boundary.
- Scope-boundary headers on the discipline trio (verification / evidence /
  rationalization) + the decision/user-choice pair; `user-choice-example` marked a
  non-invocable demo.
- Hook hygiene: `UserPromptSubmit` enum kept + documented reserved; `MessageDisplay`/
  `AgentStart`/`AgentEnd` deferral recorded in `hooks/AGENTS.md`.

## [0.0.9] — Template Demand-Side Wiring

Closes the surface audit's §3 "templates are ~78% shelfware" gap: v0.0.8 built the supply side
(every kind + multi-format index + resolver + render harness); v0.0.9 builds the demand side —
producers now reference the template surface instead of baking in their own formats.

### Added

- `rules/templates.md` — the **template-authoritative** model (`${TEMPLATE:<kind>}` substitutes
  verbatim; the template owns layout/taxonomy; producers carry only the reference) plus the
  **named-artifact rule** (any skill/agent emitting a named artifact must reference a kind via
  `${TEMPLATE}` or carry a `// REASON:` note).
- Two new producer-backed template kinds, each MD-default + JSON sibling + HTML-on-request:
  `plan-audit-report` (producer: `plan-verifier` agent) and `research-report` (producer:
  `research` skill).
- `scripts/validate/named-artifact-template.mjs` (`NAMED_ARTIFACT_TEMPLATE`) — warn-only validator
  for the named-artifact rule; graduates to hard-fail in a later release (precondition recorded in
  `docs/validators.md`).
- `designOnly: boolean` flag in `manifest/template-index.json` (schema-allowed) marking
  expected-orphan kinds; set on 10 kinds (8 pure-orphan visual + `status-report`/`incident-report`).
- Decisions record `.aegis/specs/features/ag-0012-template-wiring/decisions.md` (D1–D6).

### Changed

- `code-review` is now **template-authoritative**: the skill body shrank to a `${TEMPLATE:code-review}`
  reference + links; the Q1/Q2 location/format flow lives in `rules/user-choice-discipline.md`.
- Six orphaned producers wired to their kinds via a single `${TEMPLATE}` token (on-request formats
  named in prose): `code-architect`→`code-approaches`, `code-explorer`/`codebase-mapping`→
  `code-understanding`, `design-system-generation`→`design-system:json`, `ui-design`→
  `visual-exploration:markdown`, `finishing-branch`/`github-workflow`→`pr-writeup:markdown`,
  `learning`→`concept-explainer`. Net −115 lines of duplicated inline structure.
- Reviewer agents (`code-reviewer`, `code-quality-reviewer`, `spec-reviewer`) document their
  ReviewReport/ReviewFinding as the self-contained inline schema, distinct from the
  `code-review:json` deliverable (a `// REASON:` note records the deliberate exception).

### Removed

- `skills/core/code-review/abilities/plan30-checks.md` — a stale duplicate of the agent-inline
  ReviewReport schema, orphaned by the skill-shrink and conflating the deliverable with the
  ReviewReport.

### Honest gaps

- The named-artifact validator is **warn-only** (25 producers in the backlog); the `code-review:json`
  deliverable vs the reviewer ReviewReport remain distinct artifacts (reconciliation deferred);
  `status-report`/`incident-report` ship producerless-but-flagged. See the plan's Honest Gaps.

## [0.0.8] — Full Template Coverage + Multi-Format Output Selection

Ships the entire `references/html-effectiveness/` gallery lands as HTML
(true **20/20** on disk), each kind gains Markdown/JSON siblings where they make
sense, and a user-facing output-format selector is backed by a per-kind format
index and a format-aware `${TEMPLATE}` resolver. Cursor + Zed projections are
deferred to a dedicated v0.5.0 backlog (their five host keys stay present).

### Added

- **Full HTML template coverage (20/20)** — all 20 reference kinds now ship a
  self-contained HTML body plus a sibling `.template.json` slot manifest:
  `code-approaches`, `visual-exploration`, `code-review`, `code-understanding`,
  `design-system`, `component-variants`, `prototype-animation`,
  `prototype-interaction`, `slide-deck`, `svg-illustrations`, `status-report`,
  `incident-report`, `flowchart`, `feature-explainer`, `concept-explainer`,
  `implementation-plan`, `pr-writeup`, `triage-board`, `feature-flags`,
  `prompt-tuner`.
- **Markdown + JSON siblings (14 MD + 16 JSON)** — per the inventory
  cut: a Markdown sibling where the output is prose-shaped, a JSON sibling where
  it is data-shaped (not all three formats for every kind). 64 template bodies
  total across the three families.
- **Per-kind format index** — `manifest/template-index.json` (+ sibling schema
  `manifest/schemas/template-index.schema.json`): maps each kind to its
  `description`, `default` format, and `formats` paths. The authoritative answer
  to "which formats does kind X ship?"; read by both the resolver and the Q2
  user-choice prompt.
- **Render harness** — `scripts/tests/render-templates.mjs`: fills every body's
  slots from manifest examples, asserts all required slots are filled with no
  residual markers, and verifies index kind×format coverage. The
  missing-manifest check is a hard error.
- **Template-index validator** — `scripts/validate/template-index.mjs`: every
  indexed path exists, every shipping body is indexed, each kind's `default`
  format is present.
- **Bucket READMEs** — `templates/{html,markdown,json}/README.md` enumerate each
  family's shipping children (clears the `BUCKET_README` warnings).

### Changed

- **Format-aware `${TEMPLATE}` resolver** — `scripts/project.mjs` now resolves
  `${TEMPLATE:<kind>}` (the kind's default format) and
  `${TEMPLATE:<kind>:<format>}` (an explicit format) through the index across the
  active hosts. Backward-compatible with the pre-index bare markdown tokens. The
  earlier markdown-only / Codex-only limitation is resolved.
- **Widened Q2 user-choice** — `rules/user-choice-discipline.md` +
  `rules/user-choice-example.md` now offer the formats a kind actually ships
  (including HTML), default marked Recommended, replacing the rigid
  "JSON / Markdown / Both" contract.
- **Interactive-template minimal-JS exception (D2)** — `prototype-animation`,
  `prototype-interaction`, and `prompt-tuner` are the only templates permitted
  self-contained JavaScript (demo behavior only; no external `src`/CDN, no
  network, no tracking). Documented in `templates/AGENTS.md` and
  `docs/templates.md`; the other 17 HTML templates remain zero-JS.
- **Docs + tracker corrected** — `docs/templates.md` rewritten for the
  multi-format model; `.aegis/index/html-templates.md` re-baselined to true
  on-disk 20/20 at v0.0.8 (prior phantom ✅ marks removed) with MD/JSON sibling
  coverage.
- **Cursor + Zed deferred to ~v0.5.0** — grouped with Trae / Antigravity /
  GitHub Copilot. Status-only edits; the five host keys remain present, so no
  validator/schema surgery and the work is fully reversible at v0.5.0. The prior
  v0.0.8 (Cursor/Zed) plan moved wholesale to `.aegis/plans/v0.5.0-plan.md`.
- Version bumped to **0.0.8** across `package.json`, `manifest/aegis.manifest.json`,
  `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, and
  `.codex-plugin/plugin.json`.

## [0.0.7] — Portable Hook Intents

Ships hooks become a portable-intent surface. Each hook is declared once
in canonical `hooks/<name>.{json,md}` carrying a host-agnostic intent; the
projector emits per-host bindings (Claude lifecycle events in `.claude-plugin/`,
OpenCode `experimental.session.compacting` in `.opencode/plugins/aegis.js`). Hosts
that cannot support a given intent carry an explicit gap row in
`adapters/<host>/projection.md` — nothing is silently dropped. Per the locked
warn-then-error rollout, the `HOOK_INTENT` adapter gap-coverage check graduates to
hard-fail this release.

### Added

- **Hook-intent schema + contract validator** — `manifest/schemas/hook-intent.schema.json` (draft-07, stdlib-validated) and the `HOOK_INTENT` rule (`scripts/validate/hook-intent.mjs`, hard-fail): schema shape, the event→dispatch support table (D3), `.json`/`.md` pairing (D1), command-file existence, compaction pre⇔post symmetry, per-host adapter gap coverage, and `plugin.json` drift.
- **Twelve portable hook intents** — `session-start`, `pre-tool-use-deny`, `pre-compact`, `post-compact`, `instructions-loaded`, `file-changed`, `cwd-changed`, the Claude judgment hooks `verify-no-secrets-touched`/`no-silent-failures`/`no-rationalization`/`verification-before-completion`, and the advisory `prompt-injection-guard` scanner.
- **Symmetric compaction pair (audit row 7)** — `hooks/pre-compact.{json,md}` + `hooks/post-compact.{json,md}` project fully to Claude `PreCompact`/`PostCompact` command hooks. The OpenCode `session.compacting` binding ships a **no-op placeholder** this release; real pre/post phase dispatch is deferred until the unverified OpenCode contract is confirmed (D8).
- **Claude judgment hooks (audit row 6)** — `prompt`/`agent` dispatch PreToolUse gates with an `{ok,reason}` contract; agent hooks carry a prompt, never a pre-defined agent name (D4). Claude-only. All four ship `enabled:false` (opt-in, D11) — excluded from the default `hooks` block so a fresh install adds no deny power or per-call subagent spawns; users enable via `.claude/settings.json` (`docs/hooks.md`).
- **InstructionsLoaded + FileChanged/CwdChanged hooks (audit rows 8, 9)** — Claude command hooks; `aegis-doctor` skill consumes the instructions-loaded output; file-changed emits advisory lint/format reminders keyed to the language-overlay matcher table.
- **Advisory prompt-injection scanner (audit row 36)** — `.claude-plugin/hooks/prompt-injection-guard.mjs` (Node, no deps) scans PreToolUse tool input (`Read|Bash|WebFetch`) for known injection phrasing and emits advisory `additionalContext` only — never a `permissionDecision`, always exit 0. Ships `enabled:false` (D7), excluded from the default `hooks` block; a `userConfig.promptInjectionScanner` toggle and `.claude/settings.json` opt-in are documented in `docs/hooks.md`.
- **Docs + adapter matrices** — `docs/hooks.md` (portable hook-intent author guide) and a hook-capability matrix (supported/partial/gap per intent) in every `adapters/<host>/projection.md`. Six `hooks`-category rows added to `manifest/capabilities.json`.

### Changed

- **`HOOK_INTENT` adapter gap-coverage graduates to hard-fail** — every shipped intent must now have a per-host hook-matrix row in every adapter projection doc (keyed by `name` for judgment hooks, by `intent` otherwise).
- **Projector generates the Claude `hooks` block** (D6) from canonical declarations, byte-identical to the prior hand-maintained block for the unchanged intents; `enabled:false` intents are excluded (D7). Hook version stamps re-stamp from `package.json` on every projection.
- Version bumped to **0.0.7** across `package.json`, `manifest/aegis.manifest.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, and `.codex-plugin/plugin.json`.

### v0.0.6 Shipped — Reference-Derived Hardening

Ships validator hardening, editorial gates, lockfile + atomic-write, hook version-stamping, security scans, adversarial reviewer voice, eval skeleton. Per the locked **warn-then-error rollout**, every new validator rule lands **warn-only** in v0.0.6 and graduates to hard-fail in v0.0.7.

**Added**

- **Validator split** — `scripts/validate-structure.mjs` is now a thin entry over `scripts/validate/index.mjs`, an orchestrator that builds one shared filesystem walk + read cache and runs per-rule modules under `scripts/validate/`. Behavior-preserving (output byte-identical to v0.0.5 modulo timing). The 30s ceiling is unchanged; full run stays under 100ms.
- **Six warn-only validator rules** — `SKILL_OVER_CODEX_CAP` (8 KB UTF-8 body cap on canonical `SKILL.md`, suppressed when a `references/`/`abilities/` sibling exists), `TOOL_NAME_LEAK` (Claude-specific tool names in skill/agent prose, fenced code skipped), `AGENT_NAME_COLLISION` (cross-surface name collisions via `scripts/lib/collision-names.mjs`), `SKILL_BODY_LONG` (100-line body cap) + `SKILL_DESC_LONG` (1024-char description cap), `BUCKET_README_MISSING` (every skill bucket / template family must list its shipping children), `SKILL_LOCK_MISSING` (external-source-aware lockfile assertion).
- **Editorial gates** — `scripts/validate-prose.mjs` (~15-term LLM-cliché denylist, fenced code skipped, warn-only with a reserved `--strict`) backed by `docs/style-guide.md`; `scripts/validate-counts.mjs` (surface-count drift gate, hard-fails on drift).
- **Shared libs** — `scripts/lib/atomic-write.mjs` (UUID-suffixed tmpfile → fsync → atomic rename), `scripts/lib/settings-merger.mjs` (JSONC-tolerant merge preserving comments + trailing commas on untouched regions), `scripts/lib/collision-names.mjs`.
- **Lockfile** — `skills-lock.json` empty seed (`{version, skills}`); external-source-aware (in-tree skills need no lock entry).
- **Hook version-stamping** — every projected hook carries `# aegis-hook-version: <version>` on the line after its shebang, resolved from `package.json` at projection time and idempotent across re-runs. `project.mjs` now generates `.claude-plugin/hooks/session-start.sh` via `atomicWrite`.
- **Security-scan triplet** — `scripts/{secret-scan,base64-scan,prompt-injection-scan}.sh` (stdlib bash, no deps); mandated per PR in root `AGENTS.md`; documented in `docs/security.md`.
- **Adversarial reviewer voice** — `code-reviewer`, `code-quality-reviewer`, `doc-verifier` open skeptical-by-default (opt-in per agent, noted in root `AGENTS.md`).
- **Eval-harness skeleton** — `scripts/eval/` (`three-arm-baseline.mjs` no-op runner, `fixtures/`, `README.md`); no API calls in v0.0.6 (real arms deferred to v0.1.x+).
- **Docs** — `docs/validators.md` (rule catalog + remediation), `docs/security.md` (scan guide), `docs/skill-authoring.md` Anti-Pattern/Failure-mode call-out convention.

**Changed**

- Versions bumped to **0.0.6** across `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `.codex-plugin/plugin.json`, `manifest/aegis.manifest.json`.

**Deferred / Honest gaps**

- All new validator rules are warn-only; hard-fail graduation lands in v0.0.7.
- Eval harness is skeleton-only (no API keys, no CI gating) — full three-tier framework deferred to v0.1.x+.
- `settings-merger` preserves comments/trailing-commas on untouched regions; newly inserted keys are emitted via `JSON.stringify` (no inline comments) — documented in the module header.
- Body-content drift detection for generated trees remains deferred (re-projection-on-import is unsafe).

### v0.0.5 Shipped — Host-Docs Feature Uptake + Agent Permissions

Ships (host-docs uptake, and its sibling agent-permissions deliverable together.

**Added**

- **Capability matrix** — `manifest/capabilities.json` (15 cross-host capabilities, per-host `supported`/`partial`/`gap`/`n/a` status + evidence) and `manifest/schemas/capability.schema.json`, the single source of truth for cross-host status. `scripts/sync-capabilities.mjs` regenerates `docs/harnesses.md` (generated block) + `docs/capability-matrix.md`; `validate-structure.mjs` adds the F1 consistency lint and runs `sync-capabilities --check` as part of the single gate.
- **Claude generated-tree projection (`projectClaude`)** — canonical `skills/` + `agents/` now project to a committed `adapters/claude/{skills,agents}/` tree, and `.claude-plugin/plugin.json` `skills`/`agents` are repointed at it (DH1/DH2). Resolves `${TEMPLATE:<family>}` for Claude (clearing carried-in from v0.0.4), flattens `x-claude.paths`/`agent`/`disallowed-tools` to native keys, forks provider-tagged prose, resolves model aliases, copies `abilities`/`references`/`rules` siblings. `claude plugin validate` passes.
- **Model aliases** — `manifest/models.json` maps `opus`/`sonnet`/`haiku`/`inherit` (+ aliases) → per-host model IDs, resolved at projection time; unknown alias hard-fails.
- **Provider-tagged prose** — `<claude>…</claude>` / `<opencode>…</opencode>` blocks forked at projection (kept for the matching host, stripped elsewhere); soft cap 3 blocks/file (warn).
- **`x-claude.paths`** (glob activation; `python-developer` migrated) and **`x-claude.agent`** (auto-dispatch; `code-review` skill → `code-reviewer` agent).
- **`userConfig`** in `plugin.json` — `preferredLanguageOverlay` (string), `telemetryOptIn` (bool, default false).
- **Background monitors (Claude-only)** — `adapters/claude/monitors/{context-window-watcher,cost-watcher}.sh` + `monitors.json`, wired via `plugin.json` `experimental.monitors`. **Honest contract (DH8):** plugin monitors receive no session JSON (that is the statusline contract), so these tail the session transcript JSONL best-effort and degrade to silence (never false data) if the undocumented format shifts; reported cost is a token-derived estimate, not the bill.
- **Plugin dependencies skeleton** — `plugin.json` emits empty `dependencies: []`; projector reads an optional `manifest/dependencies.json` so a v0.0.6 split needs no projector change.
- **`.skill` ZIP distribution** — `scripts/build-dist-zip.mjs` builds a reproducible `dist/aegis.skill` (stdlib-only ZIP writer, deterministic order/mtimes) for `claude --plugin-url`; `dist/` gitignored; additive to git-spec install.
- **Agent permissions** — `manifest/permissions.json` (all 18 agents; read-only baseline + opt-in elevation across 9 buckets; 14 non-elevated, 4 elevated) + `manifest/schemas/permissions.schema.json` as the single source of truth (Iron-Law-lean agent frontmatter unchanged). Claude per-agent `tools:` allowlist injected into generated agents (the primary boundary); OpenCode `agent.<name>.permission` + global `permission` deny applied via the `aegis.js` `config(cfg)` hook (reads the manifest at runtime). The cross-cutting secret/destructive-Bash deny is enforced on Claude by a **PreToolUse hook** (`.claude-plugin/hooks/pre-tool-use-deny.sh`) — Claude plugins can't ship a declarative plugin-level deny and agent `disallowedTools` only filters the tool pool, so the hook is the host's recommended path/arg-scoped enforcement; it reads `plugin.deny[]` from the manifest at runtime. `scripts/lib/validate-permissions.mjs` (coverage, schema, Claude tools-drift, prose-vs-declared contradiction lints) wired into `validate-structure.mjs`; `scripts/test-deny-hook.mjs` covers the hook (22 deny/allow cases). `docs/agent-permissions.md` author guide + committed `.aegis/audits/agent-permissions.md` snapshot. (`Task` is inert for plugin subagents on Claude — documented; meaningful on OpenCode.)
- **`scripts/test-projection.mjs`** — `x-claude`/`x-opencode` extraction + permissions golden-output assertions (6 tests).
- **Schemas + matrices registered** in `manifest/aegis.manifest.json` (`capability`, `permissions` schemas; `matrices` block for capabilities/models/permissions).

**Changed**

- `plugin.json` `skills`/`agents`/`userConfig`/`dependencies` are now **generated** by `projectClaude()` (previously the `skills` list was hand-maintained); all other keys stay hand-maintained and are deep-preserved across projection.
- Versions bumped to **0.0.5** across `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `.codex-plugin/plugin.json`, `manifest/aegis.manifest.json`.
- `docs/architecture.md` gains a Security-posture section + updated host-status table; `adapters/*/projection.md` document the v0.0.5 uptake and honest per-host gaps.

**Deferred / Honest gaps**

- Real `aegis-core` / `aegis-languages` split (dependencies plumbed, not executed) → v0.0.6.
- OpenCode/Codex/Cursor/Zed parity for `userConfig`/monitors/`x-claude.paths`/`agent`; permissions advisory-only on Codex/Cursor/Zed (no host primitive).
- Validator detects structural Claude-tree drift only; full generated-body-content drift → v0.0.6 (re-projection on import is unsafe).
- Codex `rules/`-sibling copy (latent broken links in `python-developer`) → v0.0.6.
- `--audit` auto-regeneration of the permissions audit table → v0.0.6 (drift-lint already enforces manifest↔projection consistency).

### v0.0.4 Shipped — Statusline Presets + Templates Surface

**Added**

- **Statusline surface (`statuslines/`)** — new canonical surface. Bulletproof Node runtime (`_shared/runtime.mjs`, stdlib-only, no deps): 400 ms stdin timeout, top-level try/catch → `[Aegis]` fallback, `process.exit(0)` in `finally`, C0-control sanitization, `COLUMNS`/`LINES` env awareness. 15 `node --test` cases cover the documented disappearing-statusline failure modes.
- **8 presets** — `minimal-mono`, `essential`, `tokyo-night`, `gruvbox-dark`, `git-forward`, `cost-aware`, `token-budget`, `verbose-hud`. 16 composable segment modules; 4 named palettes (`mono`, `default`, `tokyo-night`, `gruvbox-dark`) with named-ANSI / 256-color / hex support.
- **Native PR statusline JSON** — the `pr` segment reads Claude's `pr.{number,url,review_state}` + `workspace.repo.{host,owner,name}` fields directly (no `gh` shell-out), rendering an OSC-8 hyperlink + review-state color. Folded in from the W21–W22 docs research.
- **Subagent statusline contract** — `_shared/subagent-contract.md` + `_shared/subagent-runtime.mjs`, projected to `adapters/claude/statuslines/_subagent.mjs`.
- **Claude statusline projection** — `scripts/project.mjs` emits one `.mjs` shim + `.settings.json.snippet` per preset under `adapters/claude/statuslines/`, plus the subagent variant. Install via the new `/aegis:statusline` slash command.
- **Templates surface** — `manifest/schemas/template.schema.json`; sibling `<name>.template.json` slot manifests for all 20 template bodies (5 HTML, 14 markdown, 1 JSON). HTML coverage 3 → 5 (ported `pr-writeup`, `incident-report`).
- **`${TEMPLATE:<family>}` resolver** in `scripts/project.mjs` — resolved for Codex (markdown templates copied into the Codex plugin tree; directive → bundled-path reference, cap-safe), clearing all 7 prior `${TEMPLATE}` placeholder warnings.
- **3 schemas registered** in `manifest/aegis.manifest.json` (`statusline`, `statuslineTheme`, `template`); `statuslines/` added to canonical surfaces + guidance folders.
- **Validator + inventory extended** — hand-rolled statusline descriptor/theme validation and template-manifest soft-warn in `validate-structure.mjs`; statusline + template-manifest counts in `inventory.mjs`. Validation passes in 11 ms (<30 s ceiling).

**Changed**

- Versions bumped to **0.0.4** across `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `.codex-plugin/plugin.json`, `manifest/aegis.manifest.json`.
- `orchestration` + `autonomous-execution` skill bodies note dynamic workflows as a Claude-only escalation tier above ≤5-wave fan-out.
- Adapter `projection.md` files gained honest Statuslines + Dynamic-workflows gap sections; `adapters/claude/projection.md` documents the statusline projection and the templates behavior.

**Deferred**

- **`${TEMPLATE}` resolution on Claude + OpenCode (v0.0.5)** — both read canonical `skills/` directly with no skill-body transform step; resolving needs a generated skills tree + `plugin.json` repoint. Tokens currently render literally on those hosts (unchanged from before v0.0.4; Codex resolution is new and live).
- **Dynamic workflows** — host-resident `Workflow` tool, not a plugin extension point; mention-only (see `.aegis/research/cc-w21-w22-feature-delta.research.md`).
- `code-approaches` HTML template → v0.0.5.

### v0.0.3 Shipped — Codex Projection

**Added**

- **Codex projection:** `.codex/plugins/aegis/skills/aegis-*/SKILL.md` — 79 canonical skills + 18 agents-as-skills + 13 command-as-dispatcher skills (110 total), generated by `projectCodex()` in `scripts/project.mjs`.
- **`.codex-plugin/AGENTS.md`** projected from canonical `rules/*.md` via `projectCodexRules()`. Iron Laws block at top; each rule under an `## <rule-name>` H2.
- **`.codex-plugin/plugin.json`** — Codex plugin manifest (`name`, `description`, `version`, `homepage`, `license`, `tags`). Hand-authored; `version` synced with `package.json`.
- **`.codex-plugin/mcp.json`** — MCP server stub (empty `servers: {}`); real servers deferred to v0.0.5+.
- **`.codex/INSTALL.md`** — agent-readable Codex install instructions (prerequisites, plugin-add, restart, verification, Windows notes).
- **8 KB skill body-cap lint** in `projectCodex()` and `scripts/validate-structure.mjs` (hard-fail unless sibling `references/` exists).
- **`aegis-` prefix** on every projected skill for collision avoidance with Codex reserved names (`default`, `worker`, `explorer`) and across plugins.
- **Generator fail-fast** on canonical-name collisions across scopes, agent↔skill name collisions, missing `name:` frontmatter, and invalid name shapes; skill+command name collisions resolve via `__command` suffix on the command-derived skill.
- **Codex install sections** added to `README.md` and `docs/getting-started.md`.
- **"Quote the Aegis Iron Law about abilities"** verification step in `.codex/INSTALL.md` confirms `AGENTS.md` was loaded by the host.

**Changed**

- **21 oversize canonical surfaces** brought under the 8 KB Codex cap: 11 skills now have `abilities/<topic>.md` siblings; 10 agents trimmed inline (redundant prose, AI-tells, `<instructions>` wrappers removed).
- **`scripts/validate-structure.mjs`** now checks the Codex tree: skill frontmatter shape, body cap, `AGENTS.md` H2 coverage of every canonical rule, `plugin.json` version sync with `package.json`.
- **`scripts/project.mjs`** grew from ~195 → ~440 LOC with the addition of `projectCodex()` and its sub-functions (`projectCodexSkills`, `projectCodexAgentsAsSkills`, `projectCodexCommandsAsDispatchers`, `projectCodexRules`) plus 8 KB body-cap helpers, the `aegis-` prefix helper, idempotency helpers, and inline reserved-name + name-shape guards backed by the `CODEX_RESERVED_NAMES` constant and `CODEX_NAME_PATTERN`.

### v0.0.2 Shipped — OpenCode Projection

- **Plugin:** `.opencode/plugins/aegis.js` — plain ESM JS (~190 lines, no build step). Exports `server` (and `default`/`AegisPlugin` aliases). Hooks: `config` registers all three Aegis surfaces — skills via `cfg.skills.paths`, agents via `cfg.agent.aegis-<name>` (parsing each `.opencode/agents/*.md` and inlining body as prompt), commands via `cfg.command.aegis-<name>` (same pattern, body as template). `experimental.chat.messages.transform` injects `using-aegis` SKILL body into first user message, guarded by `<!-- aegis:bootstrap -->`. Plugin uses `fs.realpathSync` to follow symlinks correctly and accepts `AEGIS_REPO_ROOT` env override.
- **Install doc:** `.opencode/INSTALL.md` with one-line `opencode.json` edit, Windows notes, AI-agent instructions, and verification step.
- **Generator:** `scripts/project.mjs` extended with `projectAgents()` and `projectCommands()`. Reads canonical, strips `kind/visibility/platforms/x-claude`, promotes `argument-hint`, injects `mode` (orchestrator=primary, others=subagent), strips invocation blockquote. Idempotent.
- **Generated agents:** 18 files at `.opencode/agents/*.md` with OpenCode-compatible frontmatter.
- **Generated commands:** 13 files at `.opencode/commands/*.md` with promoted `argument-hint`.
- **Docs:** README, getting-started, architecture, projection notes, roadmap all updated to reflect shipped state.
- **Bootstrap pattern:** rules embedded in `using-aegis` bootstrap (not `cfg.instructions[]`) per Superpowers' tested approach.
- **No regressions:** Claude v0.0.1 plugin path unchanged.

### v0.0.2 Preparation (Phase 0 research + planning complete)

- Research: `.aegis/research/v0.0.2-opencode-contract.research.md` — deep dive into OpenCode plugin contract (plugin shape, skill discovery, agents, commands, permissions, hooks, MCP, TUI, bootstrap pattern).
- Research: `.aegis/research/v0.0.2-anvil-opencode-patterns.research.md` — extracted reusable patterns from Anvil's TS plugin (skill paths injection, bootstrap marker, what NOT to copy).
- Audit: `.aegis/audits/v0.0.2-projection-gap-audit.md` — per-surface gap analysis with 6 decision items.
- Audit: `.aegis/audits/v0.0.2-transformation-inventory.md` — file-by-file transformation work breakdown.
- Spec: `.aegis/specs/features/ag-0004-opencode-projection/` — brainstorm + decisions + spec + implementation-plan.
- Task: `.aegis/tasks-opencode-projection.md`.
- Plan: `.aegis/plans/v0.0.2-plan.md` — sequenced phases A-E, ~8.5h total effort estimate.
- Decisions locked: plain ESM JS plugin in `.opencode/plugins/aegis.js`, git-spec install via INSTALL.md (Superpowers pattern), agent modes (orchestrator=primary, others=subagent), iron-laws embedded in bootstrap (not `cfg.instructions[]`).



### Added

- Phase 0 research and decision artifacts at `.aegis/research/` and `.aegis/specs/features/ag-0001-plugin-first-foundation/`.
- Architecture spec, output conventions spec, tiers spec, native tool contracts spec at `.aegis/specs/`.
- Roadmap and v0.0.1 release plan at `.aegis/plans/`.
- Root files: README, CONTRIBUTING, AGENTS, CLAUDE, CHANGELOG, package.json.
- Canonical surface scaffolds: `skills/`, `agents/`, `commands/`, `hooks/`, `rules/`, `templates/`, `adapters/`, `manifest/`, `scripts/`, `docs/`.
- Aegis surface schema (lean 5-field frontmatter) at `manifest/schemas/aegis-surface.schema.json`.
- Validation scripts: `scripts/{inventory,validate-structure,project,doctor}.mjs`.
- Claude Code plugin shim: `.claude-plugin/{plugin.json,marketplace.json,hooks/session-start.sh}`.
- Adapter projection docs for claude, opencode, codex, cursor, zed.
- Anvil portable content migrated (skills, agents, commands, rules, templates) with lean frontmatter.
- 3 standalone HTML templates: implementation-plan, code-review, status-report.
- HTML coverage tracker at `.aegis/index/html-templates.md`.

### Inventory (Final v0.0.1)

```json
{
  "skills": 79,
  "abilities": 34,
  "languageRules": 28,
  "agents": 18,
  "commands": 12,
  "rules": 12,
  "hooks": 1,
  "templates": 16,
  "adapterProjections": 5
}
```

Validation: `Aegis structure check passed (7ms)`.
Doctor total: 66ms. Ceiling: 30s.

### Decisions Locked

- Architecture: hybrid canonical + minimal adapters.
- v0.0.1 scope: canonical port + working Claude plugin.
- Surface model: skills with on-demand ability fragments.
- Frontmatter: lean 5 fields.
- Commands: hybrid (skills auto-expose + capped `commands/`).
- Hooks: defer to v0.0.5 except one Claude SessionStart.
- Statusline: defer to v0.0.6.
- HTML output: 3 templates v0.0.1, full coverage gate at v0.1.0.
- Guidance: sparse — root + main surface roots only.
- Validation: Node scripts with <30s ceiling.
