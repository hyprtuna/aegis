---
name: tool-param-permissions
description: When to gate per-agent model/isolation/background via static Tool(param:value) deny/ask rules, and the canonicalized-field boundary.
visibility: user
platforms: [claude, opencode, codex, cursor, zed]
---

# tool-param-permissions

## What this is

Claude Code accepts `Tool(param:value)` permission rules that match a
**top-level scalar input parameter** — but only for **deny/ask** rules; allow
rules keep each tool's own specifier syntax. Three canonical examples:

- `Agent(model:opus)` — Agent calls requesting the Opus tier.
- `Agent(isolation:worktree)` — Agent calls requesting a git worktree.
- `Bash(run_in_background:true)` — Bash calls that run in the background.

## How to gate (the mechanics that bite)

- **One parameter per rule.** Gating both `model` and `isolation` needs two
  separate rules, not one combined rule.
- **Wildcard `*` matches any explicit value.** `Agent(isolation:*)` matches any
  isolation value the call sets; without `*`, the match is exact.
- **Omitted-param trap.** `Agent(model:*)` does **not** match a call that
  leaves `model` unset entirely — an unset default silently slips through the
  rule. Don't rely on a wildcard rule to catch "no value given."
- **Literal, pre-normalization match.** `Agent(model:opus)` matches the alias
  `opus` as typed, not a resolved full model ID. Use `--verbose` to see the
  exact parameter names and values a call produced before writing the rule.
- **Claude-Code-specific syntax.** `Tool(param:value)` is Claude Code's own
  permission-rule syntax; other hosts gate the same capability through their
  own native permission surface instead (e.g. OpenCode's `permission.bash`).

## The non-matchable-canonical-field boundary

`command` (Bash/PowerShell), `file_path` (Read/Edit/Write), `path`
(Grep/Glob), `notebook_path` (NotebookEdit), and `url` (WebFetch) are
canonicalized by each tool's own matcher and are **deliberately not**
matchable via `Tool(param:value)`. A rule shaped like `Bash(command:<pattern>)`
is silently ignored with a startup warning, because a compound shell
invocation can route around a plain substring match on that field. Gate these
tools with their own native specifier instead: `Bash(<pattern>)`,
`Read(./path)`, `WebFetch(domain:host)`.

## Iron-law contrast (static rule vs. runtime interceptor)

The static `Tool(param:value)` rule is **ALLOWED**: it is a native,
zero-runtime permission primitive evaluated by the host — no daemon, no
injected process, no auto-injection. It is the iron-law-clean successor to the
per-agent model-routing capability previously considered.

What stays **REJECTED / deferred** is the *runtime spawn-interceptor* form (a
`PreToolUse` hook that intercepts every `Task`/`Agent` call and rewrites it
against a user-config table of per-agent model overrides): that shape needs a
background interceptor and brushes the no-auto-injection posture. Same
capability — gating what model or isolation an agent call can use — reached by
two different mechanisms; the line is static declarative rule vs. runtime
daemon, not the capability itself.

## Relation to Aegis's existing surface

Aegis already sets per-agent Claude `model` / `tools` / `disallowedTools` at
**authoring time** in `manifest/permissions.json` (projected into shipped
agent frontmatter). `Tool(param:value)` is the **user/project-side** deny/ask
complement: a user can add a rule like `Agent(model:opus)` to their own
settings to gate escalation locally, without touching Aegis internals.

**Aegis ships no such preset by default.** This rule is guidance only —
`manifest/permissions.json` deliberately carries no `Agent(model:…)` or
`Agent(isolation:…)` deny entry. Adding one is a user or project choice, not
an Aegis default.
