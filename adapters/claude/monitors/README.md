# Monitors — opt-in, off by default (AG-0258)

`monitors.json` declares the `aegis-cost` background watcher (`cost-watcher.sh`). It is
**not** wired into the default `plugin.json` — a fresh install fires zero monitors by
design. This is a deliberate, documented posture, not dead config; do not re-flag it as
unused in a future audit.

To opt in, add to your own `.claude/settings.json` (or plugin `experimental` config):

```jsonc
"experimental": { "monitors": "${CLAUDE_PLUGIN_ROOT}/adapters/claude/monitors/monitors.json" }
```

See "Background Monitors" in [`adapters/claude/projection.md`](../projection.md) for the
full contract, including the honest no-session-JSON caveat and why the retired
context-window monitor was removed in favor of the statusline `context` segment.

Removing this monitor entirely is a value-based call reserved for a future reduction
release, not this hygiene pass.
