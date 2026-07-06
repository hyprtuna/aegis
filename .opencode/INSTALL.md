# Installing Aegis for OpenCode

> **Testing locally?** If you have a local clone of Aegis and want to install it without going through git/npm, use [`INSTALL.local.md`](./INSTALL.local.md) (symlink-into-`~/.config/opencode/plugins/`).

## Prerequisites

- [OpenCode](https://opencode.ai) installed (≥1.15 for `experimental.chat.messages.transform` support).
- Aegis published to a git remote OR npm. Per the official OpenCode plugin docs, `opencode.json`'s `plugin` array accepts npm package names. Git-spec strings (`name@git+https://...`) work via Bun's package resolver in many OpenCode versions but are not officially documented; verify with your OpenCode version.

## Installation (npm — once Aegis is published)

```json
{
  "plugin": ["aegis-opencode"]
}
```

## Installation (git URL — undocumented but observed to work)

```json
{
  "plugin": ["aegis@git+https://github.com/hyprtuna/aegis.git"]
}
```

Replace `hyprtuna/aegis.git` with the actual git remote.

## What the Plugin Does

Restart OpenCode. The plugin runs at session start and:

1. Registers all 79 Aegis skills (core, language overlays, workflows) via `config.skills.paths`.
2. Registers the 18 Aegis agents inline via `config.agent.aegis-<name>` (reads each `.opencode/agents/<name>.md`, parses frontmatter, inlines the body as the agent's `prompt`).
3. Registers the 13 Aegis commands inline via `config.command.aegis-<name>` (same pattern, body becomes the command `template`).
4. Injects the `using-aegis` SKILL body into the first user message of each session, guarded by `<!-- aegis:bootstrap -->`.

No separate symlinking of agents/commands directories is required — the plugin handles all three surfaces via OpenCode's documented JSON config registration mechanism.

Verify by asking in a new OpenCode session: "Tell me about Aegis."

If you already use Aegis on another harness (Claude Code, Codex, Cursor, Zed), install separately for each — they all use their own plugin/extension mechanism.

## Pinning a Specific Version


```json
{
  "plugin": ["aegis@git+https://github.com/hyprtuna/aegis.git#v0.0.2"]
}
```

## Updating

OpenCode installs Aegis through a git-backed package spec. Some OpenCode and Bun versions cache git dependencies, so a restart may not pick up the newest commit. If updates do not appear, clear OpenCode's package cache or reinstall the plugin via:

```
opencode plugin reinstall aegis
```

## Usage

Use OpenCode's native `skill` tool:

```
use skill tool to list skills
use skill tool to load aegis-research
```

Or invoke commands directly (Aegis commands are namespaced with `aegis-`):

```
/aegis-debug
/aegis-review
/aegis-tdd
```

Dispatch agents via @ mention (Aegis agents are namespaced with `aegis-`):

```
@aegis-orchestrator help me plan this feature
@aegis-code-reviewer review the staged changes
```

## Troubleshooting

### Plugin not loading

1. Check logs: `opencode run --print-logs "hello" 2>&1 | grep -i aegis`
2. Verify the `plugin` line in your `opencode.json`.
3. Ensure you are running a recent OpenCode version that supports the `experimental.chat.messages.transform` hook.

### Bootstrap not appearing in sessions

The bootstrap (announcement of Aegis capabilities) is injected into the first user message of each session, guarded by `<!-- aegis:bootstrap -->`. If you do not see it:

- Hard-reload OpenCode (some versions cache plugin state).
- Confirm the plugin loaded by checking startup logs.
- If the bootstrap appears but skills do not auto-trigger, run `opencode run --print-logs "use skill tool to list skills"` to verify skill discovery.

### Skills not appearing in `/skills`

The plugin's `config(cfg)` hook pushes three Aegis skill directories into `cfg.skills.paths`. If those paths are missing after install:

- Confirm the plugin loaded.
- Check that the resolved paths exist (they live under the installed plugin's directory; OpenCode caches at `~/.cache/opencode/...` for git-backed installs).

### Windows install issues

Some Windows OpenCode builds have upstream installer issues with git-backed plugin specs, including cache paths for `git+https` URLs and Bun not finding `git.exe`. If OpenCode cannot install the plugin, clone the Aegis repo and follow `INSTALL.local.md` (symlink the plugin file into `~/.config/opencode/plugins/`).

## What Aegis Does Not Provide (Yet) on OpenCode

- **Statusline integration** — OpenCode has no plugin statusline slot. Aegis status appears as toast notifications when available.
- **Tool execution hooks** (`pre-tool-use`, `post-tool-use`, etc.) — Deferred to a later Aegis release (v0.0.5).
- **MCP server bundling** — Aegis does not ship MCP servers in v0.0.2.
- **Permissions defaults** — Aegis does not push a `permission` block; host defaults apply.

These gaps are documented in `adapters/opencode/projection.md` inside the Aegis repo.

## For AI Agents Installing Aegis

If you are an AI agent following instructions to install Aegis for a user, do this:

1. Read this file to confirm the install steps.
2. Locate the user's `opencode.json` (project-level: `./opencode.json`; global: `~/.config/opencode/opencode.json`).
3. Add or extend the `plugin` array with the Aegis git-spec string as shown above.
4. Confirm the edit with the user.
5. Tell the user to restart OpenCode.
6. After restart, verify by sending: `Tell me about Aegis.`

Do not write a separate install script — OpenCode's native plugin manager handles fetch and install. Your job is to edit `opencode.json` correctly and walk the user through the restart + verify steps.
