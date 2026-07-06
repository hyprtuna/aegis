# MCP Connector Policy

Aegis ships no default MCP connectors. The plugin manifest carries no
`mcpServers`, so a fresh install adds zero connector tool schemas to a session.
This page states the test a connector must pass to change that, the reason the
bar is high, and how a contributor decides whether a capability should be an MCP
server at all versus a skill, a CLI wrapper, or a direct API call.

## The two-prong test

A connector earns a default slot in Aegis only if **both** hold:

1. **Universal.** It applies to essentially every user of a coding agent, on
   every host Aegis targets (Claude Code, OpenCode, Codex, and the deferred
   Cursor/Zed). A connector that needs an API key, or that only matters to one
   workflow, fails this prong — it can ship as opt-in, never as a default.
2. **MCP genuinely beats a CLI or REST call wrapped in a skill.** The job has to
   need what MCP actually provides: a held-open interactive session, streaming,
   an auth handshake, or structured browsing of a live resource. Stateless
   request/response work is a skill. If the connector would do nothing but shell
   out once and return, it is a CLI wrapper wearing a server costume.

Both prongs must be argued explicitly, in the PR that proposes the connector.
"Popular" is not an argument. "The job is stateful and universal" is.

## Why the bar is high

Tool schemas load into every session. Each default connector taxes every user's
context window whether they use it or not — the input description, the parameter
schemas, and the output shapes are spent on every turn, for everyone, all the
time. A connector that wraps a stateless API trades a recurring per-session token
cost for a capability a skill could provide on demand, only when the task needs
it. The cheaper surface wins by default; a connector has to earn its way past
that.

The field has moved the same direction. The 2026 default across serious harnesses
is roughly zero to two connectors plus the host's native built-ins, not the
sprawling default sets of 2024. Most of what early connectors solved —
web search, memory, sequential reasoning — is now a native host capability, so
the connector is pure overhead.

## Why Aegis ships none today

Aegis carries no `mcpServers` in `.claude-plugin/plugin.json` and no root
`.mcp.json`. Two reasons:

- **Nothing passes the test yet.** No candidate connector has cleared both
  prongs for the current surface set, so the converged default is zero.
- **A concrete gateway failure makes the empty default the safe one.** Claude
  Code projects plugin MCP tools under the name `mcp__<plugin>_<server>__<tool>`.
  The plugin slug is part of that name, so a long slug plus a long server and
  tool name can exceed 64 characters. Strict OpenAI-compatible gateways reject
  tool names over 64 characters outright, which would break the session for any
  user behind such a gateway. Shipping no connectors removes that failure mode
  entirely; any future connector must be checked against the 64-character ceiling
  before it lands.

A user who wants a specific server can still configure it themselves at the
project or settings layer. Aegis simply does not push one on everyone.

## Deciding: MCP server, skill, or CLI

When a contributor has a capability in hand and is choosing a surface, walk it in
this order:

1. **Is it a deterministic, always-on constraint tied to a path or event?**
   Use a `rule`.
2. **Is it a workflow, playbook, or advisory layer that should load only when the
   task needs it?** Use a `skill`. This is the default home for most remote
   integrations — a skill can call a CLI or a REST API directly.
3. **Does it need a structured, interactive tool surface — held-open session,
   streaming, auth handshake, or live structured browsing — that more than one
   host should call repeatedly?** Only then consider an MCP server, and only if
   it also clears the two-prong test above.
4. **Is it a simple local action?** Use a CLI entry-point or repo script, wrapped
   by a skill if it needs guidance around it.
5. **Is it one narrow remote step inside a larger workflow?** Call the API
   directly from the skill or script.

When two surfaces both work, pick the smaller one: lower token overhead, fewer
external moving parts, fewer dependencies to audit. Start with a skill or a
script and promote to a connector only once the structured server boundary is
clearly paying for itself.

The same routing is summarised as a decision tree in
[`architecture.md`](architecture.md#capability-surface-selection).
