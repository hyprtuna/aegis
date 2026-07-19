---
kind: hook
name: session-start
description: Bootstrap Aegis discovery and core guidance at the start of every agent session.
visibility: internal
platforms: [claude]
---

# Session Start Bootstrap

Aegis's SessionStart hook fires when an agent host opens a session, clears context, or compacts. It announces Aegis to the agent and loads the `using-aegis` skill body as additional context — the **concise discovery bootstrap**, not a full catalog dump.

## Intent

- Tell the agent that Aegis is available.
- Point at canonical surface locations and inject an **index of the top user-invocable surfaces** (the table in `using-aegis`'s body) so the agent can route the first request without enumerating the whole catalog.
- Reference iron-law rules without inlining them.
- Use the host's idiomatic context-injection mechanism (Claude: `hookSpecificOutput.additionalContext`; OpenCode: `experimental.chat.messages.transform`).

## Host Implementations

| Host | File | Coverage |
|---|---|---|
| Claude Code | `.claude-plugin/hooks/session-start.sh` | supported |
| OpenCode | `.opencode/plugins/aegis.js` (chat.messages.transform) | supported |
| Codex | `.codex/plugins/aegis/hooks/session-start.sh` (SessionStart, bundled) | supported |
| Cursor | N/A (no hook contract) | gap |
| Zed | N/A (no hook contract) | gap |

## Bootstrap Payload

The hook emits the body of `skills/core/using-aegis/SKILL.md` (stripped of frontmatter). That skill is the canonical "you have Aegis" announcement and carries the discovery doctrine plus the **Top User-Invocable Surfaces** index. Keep it concise — every session sees it; it is a bootstrap, not a full dump.

To keep the index current, edit the table in `skills/core/using-aegis/SKILL.md`; the hook re-emits it automatically (the Claude shell script and OpenCode handler both read the live skill body at session start).

## Host coverage (honest gaps)

This hook is now bound for `claude` + `opencode` + `codex` (`platforms: [claude, opencode, codex]`). **Cursor and Zed have no portable session-start hook contract**, so the bootstrap does not auto-inject there — those hosts discover Aegis via filesystem/skill auto-discovery instead. The gap is recorded per host in `adapters/<host>/projection.md`. This is an honest gap (Iron Law 6), not a silent drop.

**Codex note:** The hook fires as a Codex `SessionStart` event. Runtime fire-and-deny verification is pending interactive Codex (the `codex exec` mode does not run plugin hooks); static + install validation have been performed.
