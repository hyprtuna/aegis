# Aegis — Codex Install

Installing Aegis on Codex gives you the full Aegis surface tree projected into Codex's first-class primitives: Agent Skills and an MCP stub. You get canonical Aegis skills, Aegis agents folded into skills (agent-as-skill), Aegis commands as thin dispatcher skills (command-as-dispatcher), and the Aegis Iron-Law rules concatenated into a single `AGENTS.md` that Codex reads at session start. Aegis ships no hooks on Codex — its `plugin_hooks` feature is removed (see `adapters/codex/projection.md#hook-capability-matrix`); bootstrap and rules loading work entirely through Skill discovery and the `AGENTS.md` read above.

## Prerequisites

- [Codex CLI](https://github.com/openai/codex) installed and on your `PATH`.
- `git` available (Codex resolves plugin sources via git).

## Install

Add Aegis to Codex from the public git remote:


```bash
codex plugin add aegis@git+https://github.com/hyprtuna/aegis.git
```

Pin a specific release if you prefer:


```bash
codex plugin add aegis@git+https://github.com/hyprtuna/aegis.git#v0.1.0
```

## Verify

Open a fresh Codex session and send:

```
List your Aegis skills
```

You should see entries prefixed `aegis-<name>` — canonical skills (e.g. `aegis-research`, `aegis-code-review`), agents-as-skills (e.g. `aegis-code-reviewer`, `aegis-orchestrator`), and commands-as-dispatchers (e.g. `aegis-debug`, `aegis-tdd`).

If the list is empty or skills do not appear, restart Codex (see next section) and re-run the verification.

### Verify rules loaded

Ask Codex to recite Aegis Iron Law #4:

> Quote the Aegis Iron Law about abilities.

A working install will return the law about "Abilities are not skills" — Aegis's parent SKILL.md is the only registered skill; `abilities/<x>.md` are on-demand fragments. If Codex doesn't know this rule, `.codex-plugin/AGENTS.md` was not picked up — check that Codex reads the file at session start.

## Restart

Codex caches plugin discovery for the lifetime of a session. After installing or upgrading Aegis:

1. Exit any running Codex session.
2. Start a new Codex session.
3. Re-run the verification phrase above.

Some Codex versions cache git-resolved plugin sources between sessions. If a reinstall does not pick up new commits, clear the Codex plugin cache (location varies by Codex version) and re-run `codex plugin add`.

## Windows notes

- Use forward-slash paths in git-spec URLs (`git+https://...`) regardless of Windows path style.
- If `file://` URLs are used for a local Aegis clone, prefix with `file:///C:/...` (three slashes) and use forward slashes.
- Ensure `git.exe` is on `PATH`. Some Codex Windows builds resolve git via `bun` or another runtime — if plugin add fails with a git-not-found error, install git for Windows and reopen your shell.
- Long-path support: enable Windows long-path support if cloning fails on deeply nested skill folders (`git config --global core.longpaths true`).

## What lands on your machine

- `.codex/plugins/aegis/skills/aegis-*/SKILL.md` — N canonical skills + M agents-as-skills + K commands-as-dispatchers, each as a Codex-native Agent Skill folder.
- `.codex-plugin/AGENTS.md` — concatenated Aegis Iron Laws and `rules/*.md` bodies, read by Codex at session start.
- `.codex/plugins/aegis/.codex-plugin/plugin.json` — Codex plugin manifest at the official plugin-root location (name, version, keywords, homepage, license, skills + mcpServers pointers).
- `.codex/plugins/aegis/.mcp.json` — MCP server stub at plugin root. No servers ship; the file exists so future releases can populate it without re-authoring the plugin shell.
- `.agents/plugins/marketplace.json` — canonical Codex marketplace registration (preferred discovery path).
- `.claude-plugin/marketplace.json` — legacy Claude / Codex marketplace registration (kept for back-compat).

## Troubleshooting

### Codex does not see Aegis skills

1. Restart Codex (close all sessions, reopen).
2. Run `codex plugin list` and confirm `aegis` is present.
3. Re-run `codex plugin add aegis@git+https://github.com/hyprtuna/aegis.git` to force a re-resolve.

### Reserved-name collision

Aegis prefixes every projected skill `aegis-<name>` precisely to avoid collisions with Codex built-in names (`default`, `worker`, `explorer`) and with other installed plugins. If you see a reserved-name error from Codex on install, file an issue — Aegis's reserved-name guard should have prevented it at projection time.

### `AGENTS.md` rules not being read

Codex reads `AGENTS.md` at session start from the project root and from plugin roots. If Aegis rules are not influencing behavior, confirm `.codex-plugin/AGENTS.md` exists inside the installed plugin tree and contains the Iron Laws block plus per-rule H2 sections. If missing, reinstall Aegis.

### Skill body not appearing

Codex uses at most ~8,000 characters on the aggregated skills-list (the names + descriptions catalog) — this budget applies only to initial skill discovery. Once Codex selects a skill it reads the full SKILL.md body with no truncation. If a selected skill's instructions seem incomplete, confirm the skill was projected correctly by re-running `node scripts/project.mjs` and reinstalling.
