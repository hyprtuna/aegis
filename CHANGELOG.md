# Changelog

All notable changes to Aegis are documented here.

This project follows [Conventional Commits](https://www.conventionalcommits.org) and [Semantic Versioning](https://semver.org).

## [Unreleased]

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
