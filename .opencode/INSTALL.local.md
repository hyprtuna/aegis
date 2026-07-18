# Installing Aegis for OpenCode — Local Clone (Symlink)

This is the primary, verified way to install Aegis for OpenCode: symlink a
local clone's plugin file into OpenCode's plugin directory. Use it for local
testing and for first-time installs alike — until Aegis publishes a real npm
package, there is no other verified path (see [`INSTALL.md`](./INSTALL.md)
for the unverified npm/git-spec alternative).

## Prerequisites

- [OpenCode](https://opencode.ai) ≥ 1.15 (needs `experimental.chat.messages.transform`).
- A local clone of Aegis at a known path.

## Method — One Symlink

Symlink the Aegis plugin file into OpenCode's global plugin directory:

```bash
AEGIS=/absolute/path/to/aegis
mkdir -p ~/.config/opencode/plugins
ln -sf "$AEGIS/.opencode/plugins/aegis.js" ~/.config/opencode/plugins/aegis.js
```

That's it. The plugin handles all three surface registrations at session start:

| Surface | Mechanism |
|---|---|
| 82 skills | `config.skills.paths` populated with absolute paths to `skills/{core,languages,workflows}` |
| 17 agents | `config.agent.aegis-<name>` populated inline (frontmatter from `.opencode/agents/<name>.md` + body as prompt) |
| 6 commands | `config.command.aegis-<name>` populated inline (frontmatter + body as template) |
| Bootstrap | `experimental.chat.messages.transform` injects `using-aegis` SKILL body into first user message, marker-guarded |

The plugin uses `fs.realpathSync` to follow the symlink to the real Aegis path, so all relative resolutions work.

Restart OpenCode (close + reopen, or just run `opencode` in a fresh shell).

## Verification

In an OpenCode session:

```
use skill tool to list skills
```

Should show ~82 entries.

Then:

```
@aegis-orchestrator help me plan something
/aegis-debug what's failing
Tell me about Aegis
```

The first user message of a fresh session should silently carry the `<!-- aegis:bootstrap -->` marker followed by the `using-aegis` SKILL body.

## Alternative — Env Var Override

If you'd rather copy the plugin instead of symlinking:

```bash
cp /absolute/path/to/aegis/.opencode/plugins/aegis.js ~/.config/opencode/plugins/aegis.js
export AEGIS_REPO_ROOT=/absolute/path/to/aegis
```

Set the env var in your shell rc so it applies to every OpenCode launch.

The symlink method is cleaner — edits to `aegis.js` in the Aegis repo apply on next OpenCode restart with no env management.

## Uninstall

```bash
rm ~/.config/opencode/plugins/aegis.js
```

## Naming Convention

Aegis agents and commands are registered with an `aegis-` prefix in OpenCode (e.g. `aegis-orchestrator`, `aegis-debug`). This prevents collisions with built-in OpenCode primary agents (`build`, `plan`) and any other plugins the user installs.

## Troubleshooting

### Plugin loads but no skills/agents/commands appear

Check OpenCode's startup logs:

```bash
opencode run --print-logs "ping" 2>&1 | grep -iE "aegis|plugin|error" | head -20
```

If `loadBootstrap` or `buildAgentEntries` threw at plugin init (e.g. missing `skills/core/using-aegis/SKILL.md` or `.opencode/agents/`), the plugin won't register anything. Confirm the files exist at the resolved path:

```bash
readlink -f ~/.config/opencode/plugins/aegis.js
# should print the path inside your Aegis clone

ls "$(readlink -f ~/.config/opencode/plugins/aegis.js | sed 's|/.opencode/plugins/aegis.js$||')/.opencode/agents" | wc -l
# should print 17
```

### Stale plugin cache

```bash
rm -rf ~/.cache/opencode/plugins/aegis* ~/.cache/opencode/packages/aegis*
```

Then restart OpenCode.

### Plugin doesn't load at all

Check OpenCode version:

```bash
opencode --version
```

Aegis targets OpenCode ≥ 1.15.

## Switching to Production

Once Aegis is published to a git remote or npm and you want to install on other machines, switch to `INSTALL.md` (git-spec or npm install). The plugin's `config(cfg)` mechanism works identically there — the install method changes but the plugin doesn't.
