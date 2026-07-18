# Installing Aegis for OpenCode

> **Primary install:** symlink a local clone into OpenCode's plugin
> directory. This is the only verified method — use it for local testing
> *and* first-time installs. See [`INSTALL.local.md`](./INSTALL.local.md).

## Prerequisites

- [OpenCode](https://opencode.ai) installed (≥1.15 for `experimental.chat.messages.transform` support).
- A local clone of Aegis (`git clone https://github.com/hyprtuna/aegis.git`).

## Installation (recommended): symlink

```bash
AEGIS=/absolute/path/to/aegis
mkdir -p ~/.config/opencode/plugins
ln -sf "$AEGIS/.opencode/plugins/aegis.js" ~/.config/opencode/plugins/aegis.js
```

Restart OpenCode. Full walkthrough (verification, troubleshooting, uninstall)
lives in [`INSTALL.local.md`](./INSTALL.local.md).

## Installation (unverified/experimental): npm or git URL

Aegis is not yet published to npm — `package.json` is `private: true` with
no `main`/`exports`, so there is nothing an npm-style install can resolve
today. Per the official OpenCode plugin docs, the `plugin` array accepts npm
package names; git-spec strings (`name@git+https://...`) work via Bun's
package resolver in some OpenCode versions but are undocumented upstream and
unverified for Aegis. Treat both forms below as experimental until Aegis
ships a published package:

```json
{
  "plugin": ["aegis"]
}
```

```json
{
  "plugin": ["aegis@git+https://github.com/hyprtuna/aegis.git"]
}
```

Replace `hyprtuna/aegis.git` with the actual git remote.

## What the Plugin Does

Restart OpenCode. The plugin runs at session start and:

1. Registers all 82 Aegis skills (core, language overlays, workflows) via `config.skills.paths`.
2. Registers the 17 Aegis agents inline via `config.agent.aegis-<name>` (reads each `.opencode/agents/<name>.md`, parses frontmatter, inlines the body as the agent's `prompt`).
3. Registers the 6 Aegis commands inline via `config.command.aegis-<name>` (same pattern, body becomes the command `template`).
4. Injects the `using-aegis` SKILL body into the first user message of each session, guarded by `<!-- aegis:bootstrap -->`.

No separate symlinking of agents/commands directories is required — the plugin handles all three surfaces via OpenCode's documented JSON config registration mechanism.

Verify by asking in a new OpenCode session: "Tell me about Aegis."

If you already use Aegis on another harness (Claude Code, Codex, Cursor, Zed), install separately for each — they all use their own plugin/extension mechanism.

## Pinning a Specific Version (unverified git-spec method only)

```json
{
  "plugin": ["aegis@git+https://github.com/hyprtuna/aegis.git#v0.1.0"]
}
```

## Updating

**Symlink install (recommended):** pull the latest commits in your local
Aegis clone. OpenCode picks up the change on next restart — no reinstall
needed.

**Unverified npm/git install:** OpenCode installs Aegis through a git-backed
or npm package spec. Some OpenCode and Bun versions cache these, so a
restart may not pick up the newest commit. If updates do not appear, clear
OpenCode's package cache or reinstall the plugin via:

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
- **Tool execution hooks** (`pre-tool-use`, `post-tool-use`, etc.) — OpenCode has no PreToolUse/PostToolUse hook event; see the hook capability matrix in `adapters/opencode/projection.md` for the current per-hook status.
- **MCP server bundling** — Aegis ships no MCP servers by default (see `docs/mcp-policy.md`).
- **Permissions defaults** — Aegis does not push a `permission` block; host defaults apply.

These gaps are documented in `adapters/opencode/projection.md` inside the Aegis repo.

## For AI Agents Installing Aegis

If you are an AI agent following instructions to install Aegis for a user, do this:

1. Read [`INSTALL.local.md`](./INSTALL.local.md) to confirm the symlink
   install steps — the recommended, verified method.
2. Locate the user's local Aegis clone path.
3. Create `~/.config/opencode/plugins/` if needed and symlink
   `.opencode/plugins/aegis.js` into it, as shown in `INSTALL.local.md`.
4. Confirm the edit with the user.
5. Tell the user to restart OpenCode.
6. After restart, verify by sending: `Tell me about Aegis.`

Do not use the npm/git-spec `plugin` array form — it is unverified for
Aegis. Do not write a separate install script; the symlink is the only step
required.
