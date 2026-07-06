# Contributor vs User Boundary

## User

A user is anyone running Aegis content via Claude Code, OpenCode, Codex, Cursor, or Zed.

Users:
- Install Aegis via their host's plugin system (e.g. `/plugin install aegis@aegis` in Claude).
- Never run `node`, `bun`, or any Aegis CLI.
- Don't need Node, npm, or Bun installed for daily use.
- Don't edit files in this repo.

## Contributor

A contributor is anyone editing Aegis content or tooling.

Contributors:
- Need Node 20+ installed (for `scripts/*.mjs`).
- Run `node scripts/validate-structure.mjs` before committing.
- Follow the layout in `AGENTS.md` and `docs/skill-authoring.md`.
- Update `.aegis/plans/v0.0.x-plan.md` checkboxes as work completes.

## Hard Boundaries

- **No user CLI.** Aegis ships zero user-facing binaries. Maintainer Node scripts in `scripts/` are not exposed to users.
- **No user build step.** Hosts load Aegis content as-is. No transpile, no bundle.
- **Maintainer tooling cannot leak into runtime.** If `scripts/project.mjs` generates `.cursor/rules/*.mdc`, the generated files are committed and shipped — the script is never run by users.
- **Validation runs in <30s.** Anvil's test suite reaches 20 minutes. That is the failure mode we explicitly avoid.
