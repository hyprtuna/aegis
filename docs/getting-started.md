# Getting Started

Aegis installs as a plugin. There is no CLI, no Bun, and no npx — your host
reads the surfaces directly. The short install form for every host lives in
[`README.md`](../README.md); this page is the full step-by-step flow, including
how to confirm the install loaded and how to make your first call.

Aegis ships three active hosts: Claude Code, OpenCode, and Codex. Cover them in
that order. Wherever you see `/path/to/aegis`, substitute the directory where you
cloned this repository.

## Claude Code

1. Clone Aegis to a local directory:
   ```bash
   git clone https://github.com/hyprtuna/aegis.git /path/to/aegis
   ```

2. Add the local marketplace, then install the plugin:
   ```
   /plugin marketplace add /path/to/aegis
   /plugin install aegis@aegis
   ```
   The repo root ships a valid Claude marketplace at
   `.claude-plugin/marketplace.json` (plugin `source: "./"`), so
   `claude plugin validate .` passes and the two steps above work as written.

3. Verify it loaded. In a new session, run:
   ```
   /skills
   ```
   You should see entries prefixed `aegis:` (for example `aegis:research`). If
   none appear, the plugin did not install.

4. First invocation:
   ```
   Use the aegis:research skill to investigate X.
   ```

5. Troubleshooting: if `/skills` shows no `aegis:` entries, run `/plugin list`
   and confirm `aegis` is present; if it is missing, repeat step 2.

## OpenCode

1. Symlink the plugin file into OpenCode's global plugin directory (adjust
   the path to your local clone):
   ```bash
   AEGIS=/path/to/aegis
   mkdir -p ~/.config/opencode/plugins
   ln -sf "$AEGIS/.opencode/plugins/aegis.js" ~/.config/opencode/plugins/aegis.js
   ```
   This is the primary, verified OpenCode install; see
   `.opencode/INSTALL.local.md` for the full walkthrough. An npm/git-spec
   `plugin` array entry is unverified for Aegis until it publishes a
   package — see `.opencode/INSTALL.md`.

2. Restart OpenCode so it picks up the new plugin.

3. Verify it loaded. In a fresh session, send:
   ```
   Tell me about Aegis.
   ```
   A loaded install responds with Aegis context from the session bootstrap.

4. First invocation:
   ```
   Use the skill tool to load aegis-research, then investigate X.
   ```

5. Troubleshooting: if nothing loads, confirm the symlink resolves
   (`readlink -f ~/.config/opencode/plugins/aegis.js`) and that you restarted
   OpenCode after creating it.

## Codex

1. Add Aegis:
   ```bash
   codex plugin add aegis@git+https://github.com/hyprtuna/aegis.git
   ```

2. Restart Codex so it picks up the new plugin.

3. Verify it loaded. In a fresh session, ask:
   ```
   List your Aegis skills
   ```
   You should see entries prefixed `aegis-` (for example `aegis-research`).

4. First invocation:
   ```
   Use aegis-research to investigate X.
   ```

5. Troubleshooting: if no `aegis-` skills appear, re-run the `codex plugin add`
   command and restart Codex.

## Zed via OpenCode ACP

Zed reaches the full Aegis surface today through OpenCode's ACP (Agent Client
Protocol) bridge — no new Aegis code required. Install the OpenCode plugin
first (see [OpenCode](#opencode) above), then point Zed at the `opencode acp`
subcommand.

1. Confirm the OpenCode plugin is installed and verified (the OpenCode section
   above).

2. Add to `~/.config/zed/settings.json`:
   ```json
   {
     "agent_servers": {
       "OpenCode": {
         "command": "opencode",
         "args": ["acp"]
       }
     }
   }
   ```
   Over ACP, Zed launches the full OpenCode engine as a subprocess — the same
   engine that carries the Aegis skills, `.opencode/commands/` slash commands,
   agents, and session bootstrap. Nothing Aegis-specific needs to be installed
   for Zed itself.

3. Verify it loaded. Open Zed's Agent Panel, select the "OpenCode" agent
   server, and send:
   ```
   Tell me about Aegis.
   ```
   A loaded install responds with Aegis context from the session bootstrap.

4. Honest gaps — read before relying on this path:
   - **Question tool disabled by default.** `AskUserQuestion` and the
     `user-choice-discipline` rule depend on OpenCode's interactive question
     tool, which ACP disables unless you set
     `OPENCODE_ENABLE_QUESTION_TOOL=1` in the environment that launches
     `opencode acp`. Without it, those flows degrade silently.
   - **`/undo` and `/redo` are unsupported over ACP.** These built-in OpenCode
     slash commands do not work through the ACP bridge (upstream limitation).
   - **Bootstrap-over-ACP is unverified.** The session bootstrap relies on
     `experimental.chat.messages.transform`; whether that hook fires when
     OpenCode is launched via `opencode acp` has not been verified in this
     release. Treat it as unverified, not confirmed working.

Cursor is not yet supported; it remains deferred to roughly v0.5.0. See
`.aegis/plans/_roadmap.md` for the schedule.

## What's available

| Surface | Where to look |
|---|---|
| Skills | `skills/` (core, languages, workflows) |
| Agents | `agents/` |
| Commands | `commands/` |
| Rules | `rules/` (iron laws — always loaded) |
| Templates | `templates/` |

## For maintainers

```bash
node scripts/inventory.mjs           # surface counts
node scripts/validate-structure.mjs  # structure check
node scripts/doctor.mjs              # combined diagnostics
```

All maintainer scripts run on Node 20+ with no installed dependencies.
