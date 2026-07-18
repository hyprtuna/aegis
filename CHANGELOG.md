# Changelog

All notable changes to Aegis are documented here.

This project follows [Conventional Commits](https://www.conventionalcommits.org) and [Semantic Versioning](https://semver.org).

## [Unreleased]

## [v0.1.0] — 2026-07-19

Public launch. Aegis is a plugin-first agentic AI development system for Claude Code, OpenCode, and Codex — a curated, portable set of skills, agents, commands, rules, hooks, and templates that load natively in your host. There is no CLI and no build step: you add Aegis as a plugin and your host reads the surfaces directly.

- **Surfaces:** 82 skills, 17 agents, 6 commands, 17 rules, 7 hooks, 73 templates, 9 statusline presets, and 5 host adapter projections (Claude Code, OpenCode, and Codex active).
- **Install documentation corrected across the three active hosts** — the Claude Code `/plugin marketplace add` command, the OpenCode `~/.config/opencode/plugins` symlink install (now the documented primary method), and a new Zed-via-OpenCode-ACP path.
- **Zed reachable today** via the OpenCode ACP bridge (skills, slash commands, and agents), with honest gaps recorded for what remains unverified on that path. Cursor and a native Zed extension stay deferred (~v0.5.0).
- Version baseline set to 0.1.0 for the public launch.
