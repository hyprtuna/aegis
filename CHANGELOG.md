# Changelog

All notable changes to Aegis are documented here.

This project follows [Conventional Commits](https://www.conventionalcommits.org) and [Semantic Versioning](https://semver.org).

## [Unreleased]

## [v0.2.2] — 2026-07-21

**Breaking: 62 skills no longer appear in your slash menu.** Their content is not gone — every one is preserved as an on-demand fragment under a parent skill. The mapping is below; nothing was lost except one skill deleted on purpose.

- **82 registered skills became 20.** A skill you invoke is now a phase you are in, not a topic you look up. Specialist material rides along as 126 abilities plus 28 language-rule overlays, loaded by the parent when the work calls for it rather than sitting in every session's menu competing for the model's attention. This follows the pattern Aegis's structure came from.
- **One bucket.** `skills/languages/` and `skills/workflows/` are dissolved; all 20 live in `skills/core/`. Bucket discovery now derives from the filesystem, so a future layout change cannot leave a validator silently checking a directory that no longer exists — which had already happened twice.
- **Chaining is prose, and it is now verified.** The `x-aegis.pipeline` frontmatter was removed: it reached no host, and generated skill bodies were shipping sentences explaining frontmatter the projector had already stripped. Phases hand off with `REQUIRED SUB-SKILL` / `REQUIRED BACKGROUND` markers in the body, and the composition validator checks that graph — 9 live edges where it previously checked 2 dead ones.
- **Fixed: Codex was missing 28 files.** Two sibling-copy allowlists disagreed, so every language `rules/*.md` reached Claude and none reached Codex. Both now derive from one source.
- **Fixed: fragments could not carry template directives.** Nested fragments were copied verbatim while only `SKILL.md` bodies had `${TEMPLATE:*}` resolved, so the first fold carrying a token would have thrown at projection.
- **Regression, recorded honestly:** editing a `*.go` file used to auto-activate the Go skill through a `paths` glob. No skill declares one now, so nothing auto-activates — you reach for `develop`, which selects fragments by the files a task touches. `paths` gates activation, so putting a union of language globs on `develop` would have hidden it for general work; the capability is marked a gap rather than quietly left claiming support.

### Where your skills went

Language skills (`aegis:go-developer`, `aegis:python-developer`, and 17 more) → `develop`, as `abilities/languages/<lang>.md` with practice and rules beneath it. Invoke `aegis:develop`; it selects by the files you are touching, and layers framework onto language.

| Was | Now — a fragment of… |
|---|---|
| `aegis:aegis-doctor` | `using-aegis/abilities/health-check.md` |
| `aegis:architecture-decision-record` | `brainstorm-spec/abilities/adr.md` |
| `aegis:autonomous-execution` | `orchestrate/abilities/autonomous-loop.md` |
| `aegis:changelog-generation` | `doc-writing/abilities/changelog.md` |
| `aegis:claude-md-improvement` | `codebase-onboarding/abilities/context-file-audit.md` |
| `aegis:code-simplification` | `develop/abilities/simplification.md` |
| `aegis:code-tour` | `codebase-onboarding/abilities/code-tour.md` |
| `aegis:codebase-mapping` | `codebase-onboarding/abilities/mapping.md` |
| `aegis:color-palette-design` | `ui-design/abilities/color.md` |
| `aegis:deep-diving` | `codebase-onboarding/abilities/deep-dive.md` |
| `aegis:dependency-management` | `develop/abilities/dependencies.md` |
| `aegis:design-exploration` | `brainstorm-spec/abilities/exploring-intent.md` |
| `aegis:design-system-generation` | `ui-design/abilities/design-systems.md` |
| `aegis:dispatching-parallel-agents` | `orchestrate/abilities/dispatching.md` |
| `aegis:doc-verification` | `doc-writing/abilities/verifying-docs.md` |
| `aegis:feature-developer` | `default-feature/abilities/end-to-end.md` |
| `aegis:framework-selection` | `research/abilities/framework-comparison.md` |
| `aegis:general-developer` | `develop/abilities/general.md` |
| `aegis:github-coordination` | `orchestrate/abilities/github-coordination.md` |
| `aegis:github-workflow` | `git-workflow/abilities/github.md` |
| `aegis:gitlab-workflow` | `git-workflow/abilities/gitlab.md` |
| `aegis:learning` | `codebase-onboarding/abilities/explaining.md` |
| `aegis:mcp-construction` | `develop/abilities/mcp-servers.md` |
| `aegis:orchestrator-guide` | `orchestrate/abilities/when-to-fan-out.md` |
| `aegis:parallel-wave-executor` | `orchestrate/abilities/wave-execution.md` |
| `aegis:performance-profiling` | `debugging/abilities/profiling.md` |
| `aegis:plan-structure-audit` | `implementation-planner/abilities/plan-audit.md` |
| `aegis:project-exploration` | `codebase-onboarding/abilities/exploration.md` |
| `aegis:read-background-results` | `orchestrate/abilities/background-results.md` |
| `aegis:recall` | `using-aegis/abilities/recall.md` |
| `aegis:review-requesting` | `code-review/abilities/requesting.md` |
| `aegis:sdd-workflow` | `default-feature/abilities/spec-first.md` |
| `aegis:silent-failure-discipline` | `code-review/abilities/silent-failures.md` |
| `aegis:skill-extraction` | `skill-creation/abilities/extraction.md` |
| `aegis:skill-selection` | `using-aegis/abilities/routing.md` |
| `aegis:style-selection` | `ui-design/abilities/style-families.md` |
| `aegis:subagent-execution` | `orchestrate/abilities/subagent-execution.md` |
| `aegis:summarization` | `orchestrate/abilities/summarization.md` |
| `aegis:task-decomposition` | `implementation-planner/abilities/decomposition.md` |
| `aegis:test-analysis` | `test-driven-development/abilities/coverage-analysis.md` |
| `aegis:two-stage-review` | `code-review/abilities/two-stage.md` |
| `aegis:typography-pairings` | `ui-design/abilities/typography.md` |
| `aegis:ui-anti-pattern-rules` | `ui-design/abilities/anti-patterns.md` |
| `aegis:ux-reasoning-rules` | `ui-design/abilities/ux-reasoning.md` |

`aegis:skill-router-gate` was deleted outright — the SessionStart bootstrap already performs that routing.

## [v0.2.1] — 2026-07-20

- **`kind:` is retired.** No host ever recognised the field, the projector already discarded it, and a surface's kind is stated by the directory it lives in. Removed from all 123 canonical surfaces plus the language fragments and template bodies, dropped from the schema, and now rejected by the `FRONTMATTER` rule so it cannot drift back. It survives only where it is a live discriminator — hook, statusline, and template JSON.
- **`visibility:` finally does something.** It was declared on 123 surfaces while branching zero lines of code; it now projects to Claude's native `user-invocable: false`, hiding an internal skill from the `/` menu while leaving it invocable by a parent. `disable-model-invocation` is deliberately not used — it would remove the skill from context entirely and sever parent-to-child dispatch. OpenCode and Codex have no equivalent, recorded as honest gaps rather than silently dropped.
- **Model choice is capability intent, not a vendor name.** Agents declare `deep`, `balanced`, `fast`, or `inherit` — what kind of thinking the work needs — and the manifest resolves that to a host-native model. The old Anthropic-family names still resolve for back-compat but can no longer be declared, and the per-host model IDs nothing ever read are gone. A dispatch-time model override still wins over the projection, which is now documented with the full precedence chain.
- **The Codex hook projector is deleted.** Codex removed `plugin_hooks` upstream, so a plugin-shipped hook cannot fire there in any context; the projector, its schema definition, its event enum, and its drift gate produced four reproduced defects across three review rounds while projecting nothing. Declaring `codex` in a hook's platforms is now a hard error naming the reason, in both the validator and the projector, so the capability fails loudly instead of silently.
- **Hook helpers are protected by declaration, not by spelling.** A shared helper used to survive the projector's prune only if its filename began with an underscore, so renaming it to `lib.sh` deleted it and broke every hook that sourced it. Hooks now declare their dependencies, and the prune and the orphan rule derive that set from one shared function so they cannot disagree.
- **An advertised entry point can no longer be hidden by accident.** Making `visibility:` load-bearing promoted years of unaudited declarations into user-facing behaviour at once, and two of the eight internal skills turned out to be the documented ways to start a feature and to write a plan — both about to vanish from the `/` menu while the bootstrap kept recommending them. Fixed, and a new hard-fail rule keeps the guidance table and the field in agreement.

## [v0.2.0] — 2026-07-20

- **The git guard is gone.** The PreToolUse deny hook is removed entirely — protected-branch policy, destructive-ops checks, and the `AEGIS_ALLOW_GIT_GUARD` override. It blocked legitimate work repeatedly while catching nothing dangerous: it classified commands by matching their text rather than by what they would do, and it resolved the current branch from the session directory, so every commit made inside a git worktree was denied as a commit to `main`. Protected-branch guidance now lives in `rules/protected-branch-discipline.md`, where a team practising trunk-based development is advised rather than blocked, and a team wanting a hard block is pointed at forge branch protection or their own `pre-push` hook.
- **Hooks halved, and the survivors are honest.** Five hooks declared `enabled: false` and never fired; they and their payloads are deleted, along with an unregistered script that shipped to users regardless, and the `enabled` field is gone from the schema so the state cannot recur. Aegis now ships four live hooks: `SessionStart`, `PreCompact`, `PostCompact`, `InstructionsLoaded`.
- **Codex hook bindings removed.** Verified against `codex features list` on codex-cli 0.144.6: `plugin_hooks` is `removed`, so a plugin-distributed hook cannot fire on Codex in any context. The bindings are gone and the gap is declared in `adapters/codex/projection.md` rather than silently dropped. Aegis's Codex bootstrap continues through native skill discovery.
- **OpenCode hooks were registered under keys OpenCode never resolves.** The generated plugin nested its handlers (`experimental: { chat: { messages: { transform } } }`) while OpenCode's own type contract declares them as flat quoted dotted properties. The bootstrap was shipped and never invoked. Handlers now emit flat dotted keys, and `pre-compact`/`post-compact` no longer collide on one event.
- **Install from git.** `/plugin marketplace add hyprtuna/aegis` replaces the clone-and-add-a-local-path flow. A local-path marketplace copies the working directory including gitignored content — measured at 1.1 GB per installed version, most of it vendored reference docs that are not in the repository.
- **The projector now prunes what it stops generating.** Removing a hook left its generated script behind, unreferenced, shipped. Both host trees now prune orphans, announce every deletion, and refuse to delete a directory; a validator rule fails the build if an unreferenced script survives. The hook counter also stopped miscounting — it read `hooks/*.md`, so any hook without a doc file was invisible.

## [v0.1.6] — 2026-07-20

- **Validation no longer walks the private planning repo.** The shared validation walk made an explicit exception to include it, so broken internal links belonging to a separate repository failed the public repo's gate — while CI, which clones fresh and never sees that gitignored directory, passed. Local and CI results disagreed; they now agree. Maintainer tooling only, no user-facing change.

## [v0.1.5] — 2026-07-20

- **Git guard no longer denies legitimate pushes in compound commands** — the protected-branch check scanned every token after `git push` to end-of-string, so a later mention of `main` (`git push origin release/x && gh pr create --base main`) was misread as the push destination and denied. Each `git push` in a command is now scanned against its own refspecs.
- The same fix closes the false negative the naive form would introduce: a second push in the same command (`git push origin feat/x && git push origin main`) is still caught.
- Deny-hook regression coverage extended to compound commands in both directions (57 cases, up from 48).

## [v0.1.4] — 2026-07-19

- **Pre-launch residue swept from shipped content** — internal `AG-NNNN` ticket references were replaced with their descriptive rationale, and pre-launch `v0.0/0.2/0.3.x` version stamps were reconciled, across scripts, statuslines, manifest, hooks, adapters, canonical surfaces, and docs. Broken private-repo links were repointed to public anchors.
- **`SHIPPED_REF` validator** (warn-only) now guards against ticket-number references and pre-launch version stamps re-entering shipped content (the private planning tree is exempt); it graduates to a hard failure in a later release.

## [v0.1.3] — 2026-07-19

- **Removed two non-functional hooks** — `FileChanged` (its matcher cannot express the intended watch) and `CwdChanged` (its context never reached the agent); both are gone from all shipped surfaces (docs, host projections, language-skill activation notes). They remain in the schema enum as forward-compat reservations only.
- **Marketplace-install guidance** — documented that Aegis must be installed via `/plugin marketplace add` (not `--plugin-dir`, which double-loads), and reconciled the adapter guidance to state that `adapters/claude/` is the generated Claude-native projection (the sanctioned exception to the no-duplication rule).
- **Opt-in cost monitor documented** (`adapters/claude/monitors/README.md`) — off by default.
- Dropped the undocumented `argument-hint` field from the OpenCode command projection (kept on Claude); documented the dogfooding double-registration.

## [v0.1.2] — 2026-07-19

- **Forceful skill-invocation bootstrap.** The injected SessionStart guidance now carries a compact, host-neutral skill-invocation gate plus a Red Flags table (ported from the superpowers pattern), so a relevant skill is invoked instead of being rationalized away.
- **"When to use" skill descriptions.** Rewrote 13 skill/agent descriptions to pure triggering conditions (when to use, not what they do), improving routing.
- **`DESCRIPTION_SHAPE` validator** (warn-only) flags arrow / mechanism-verb descriptions; slated to graduate to hard-fail in a later release.
- **Routing acceptance harness** revived from a dead skeleton into a static, no-API lint over a routing fixture (manual-run).

## [v0.1.1] — 2026-07-19

- **User-selectable HTML output, end-to-end on Claude.** The output-format choice now resolves at runtime — the agent reads the template index, takes the chosen format, and reads the bundled template — closing a path that was previously inert. The two HTML-shipping report producers and the research skill now present the format choice.
- **Codex template substrate bundled** — the Codex plugin now ships the HTML and JSON templates plus the template index (fixing a latent `:json` pointer gap). HTML/JSON selection is honestly documented as `partial` on Codex and OpenCode (no runtime plugin-root token) and closed on Claude.
- **HTML accessibility criterion** added to the output conventions — semantic landmarks, WCAG AA contrast, keyboard-reachable controls, `aria-hidden` on decorative SVG.
- Corrected the `implementation-plan` template default to markdown; documented the orphaned template kinds.

## [v0.1.0] — 2026-07-19

Public launch. Aegis is a plugin-first agentic AI development system for Claude Code, OpenCode, and Codex — a curated, portable set of skills, agents, commands, rules, hooks, and templates that load natively in your host. There is no CLI and no build step: you add Aegis as a plugin and your host reads the surfaces directly.

- **Surfaces:** 82 skills, 17 agents, 6 commands, 17 rules, 7 hooks, 73 templates, 9 statusline presets, and 5 host adapter projections (Claude Code, OpenCode, and Codex active).
- **Install documentation corrected across the three active hosts** — the Claude Code `/plugin marketplace add` command, the OpenCode `~/.config/opencode/plugins` symlink install (now the documented primary method), and a new Zed-via-OpenCode-ACP path.
- **Zed reachable today** via the OpenCode ACP bridge (skills, slash commands, and agents), with honest gaps recorded for what remains unverified on that path. Cursor and a native Zed extension stay deferred (~v0.5.0).
- Version baseline set to 0.1.0 for the public launch.
