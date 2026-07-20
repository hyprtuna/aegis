# Getting Started

Aegis installs as a plugin. There is no CLI, no Bun, and no npx — your host
reads the surfaces directly. The short install form for every host lives in
[`README.md`](../README.md); this page is the full step-by-step flow, including
how to confirm the install loaded and how to make your first call.

Aegis ships three active hosts: Claude Code, OpenCode, and Codex. Cover them in
that order. Wherever you see `/path/to/aegis`, substitute the directory where you
cloned this repository.

## Claude Code

1. Add the marketplace, then install the plugin:
   ```
   /plugin marketplace add hyprtuna/aegis
   /plugin install aegis@aegis
   ```
   Claude Code accepts the GitHub `owner/repo` shorthand directly for
   `/plugin marketplace add`, so no clone step is needed. The repo root ships
   a valid Claude marketplace at `.claude-plugin/marketplace.json` (plugin
   `source: "./"`), so `claude plugin validate .` passes; relative plugin
   sources like `"./"` resolve against the local copy Claude Code makes when
   it fetches a marketplace, whether that copy came from a git source or a
   local directory, so the entry works the same way here as it would from a
   clone.

2. Verify it loaded. In a new session, run:
   ```
   /skills
   ```
   You should see entries prefixed `aegis:` (for example `aegis:research`). If
   none appear, the plugin did not install.

3. First invocation:
   ```
   Use the aegis:research skill to investigate X.
   ```

4. Troubleshooting: if `/skills` shows no `aegis:` entries, run `/plugin list`
   and confirm `aegis` is present; if it is missing, repeat step 1.

**Marketplace install only.** The step above (`/plugin marketplace add` +
`/plugin install`) is the only supported Claude Code install path. Aegis's
`plugin.json` declares `skills`/`agents`/`commands` keys pointing at the
generated `adapters/claude/…` tree (see [`adapters/claude/projection.md`](../adapters/claude/projection.md)),
which **replaces** Claude's default root-folder scan under a marketplace
install — the only residual is a cosmetic "ignored default folder" warning on
Claude Code v2.1.140+. Loading Aegis via `claude --plugin-dir /path/to/aegis`
instead is a **maintainer footgun, not a supported user path**: `--plugin-dir`
*adds* to the default scan rather than replacing it, so every canonical
skill/agent/command double-loads alongside its generated counterpart. Always
install via the marketplace flow above.

**Maintainer note: working against an unreleased checkout.** To load a local
working copy instead of the published git source — for example to test an
unmerged branch before it ships — clone the repo and add the clone as a local
marketplace:
```bash
git clone https://github.com/hyprtuna/aegis.git /path/to/aegis
```
```
/plugin marketplace add /path/to/aegis
/plugin install aegis@aegis
```

A local-path marketplace copies the maintainer's **working directory**,
gitignored content included — it is not a lighter install, it is a heavier
one. Measured on a maintainer machine: 1.1 GB per installed version, of which
1021 MB came from `references/`, a directory with zero files tracked in git.
The git-sourced install above carries only what the repository tracks. Use
the local-clone form for unreleased-checkout development only, never as
install guidance for users.

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

Zed reaches Aegis skills, `.opencode/commands/` slash commands, and agents
today through OpenCode's ACP (Agent Client Protocol) bridge — no new Aegis
code required. Install the OpenCode plugin first (see [OpenCode](#opencode)
above), then point Zed at the `opencode acp` subcommand. See the honest gaps
below for what is unverified on this path.

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
   and agents. Nothing Aegis-specific needs to be installed for Zed itself.

3. Verify it loaded. Open Zed's Agent Panel, select the "OpenCode" agent
   server, and send:
   ```
   Use the skill tool to list available skills.
   ```
   A loaded install lists the Aegis skill set (~20 skills). You can also
   invoke an Aegis command or agent directly to confirm the surface loaded.

4. Honest gaps — read before relying on this path:
   - **Question tool disabled by default.** `AskUserQuestion` and the
     `user-choice-discipline` rule depend on OpenCode's interactive question
     tool, which ACP disables unless you set
     `OPENCODE_ENABLE_QUESTION_TOOL=1` in the environment that launches
     `opencode acp`. Without it, those flows degrade silently.
   - **`/undo` and `/redo` are unsupported over ACP.** These built-in OpenCode
     slash commands do not work through the ACP bridge (upstream limitation).
   - **Skills/agents registration over ACP is documented, not yet hands-on
     verified.** The ACP reference documents commands working over the
     bridge explicitly; plugin `config()`-registered skills/agents loading
     the same way is expected but has not been hands-on verified in this
     release.
   - **Bootstrap-over-ACP is unverified.** The session bootstrap relies on
     `experimental.chat.messages.transform`; whether that hook fires when
     OpenCode is launched via `opencode acp` has not been verified in this
     release. Treat it as unverified, not confirmed working — do not rely on
     it to confirm the install loaded (use the skill-listing check above
     instead).

Cursor is not yet supported; it remains deferred to roughly v0.5.0. See
`docs/roadmap.md` for the schedule.

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
