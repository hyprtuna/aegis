# Portable Hook Intents

Aegis declares each lifecycle hook **once** as a host-agnostic *intent* in
`hooks/<name>.json`, then projects per-host bindings from it. This page is the
author's guide: the file format, the host bindings, the event→dispatch rules,
and the steps to add a new intent.

The authoritative contract is `manifest/schemas/hook-intent.schema.json`; the
`HOOK_INTENT` rule in `scripts/validate/hook-intent.mjs` enforces it. The
projector (`scripts/project.mjs`) reads the intents and generates the host files.
Never hand-edit a generated host file — edit the canonical `.json` and re-run
`node scripts/project.mjs`.

A hook either ships (a `hooks/<name>.json` intent exists and projects) or it is
deleted outright. There is no disabled/parked state — the schema carries no
`enabled` field, and `HOOK_INTENT` hard-fails if one appears.

## The `hooks/<name>.{json,md}` pair (D1)

The folder is flat. Each hook is up to two files:

- **`hooks/<name>.json`** — the machine binding and source of truth for
  projection.
- **`hooks/<name>.md`** — the human intent doc (lean 5-field frontmatter,
  `kind: hook`).

`.md` is **required** when the dispatch is `prompt` or `agent`, or the intent is
`pre-compact` / `post-compact`; it is **optional** for pure command hooks
(`session-start`, `instructions-loaded`). When both files
exist, the `.json` `name` must equal the `.md` frontmatter `name`.

Judgment hooks (`prompt-type` / `agent-type` intent) may carry a cosmetic
filename infix — `<name>.prompt.json` or `<name>.agent.json`. The infix is
presentational; the `intent` field is the authoritative discriminator, and
`name` drops the infix. Aegis ships no judgment hook today (see "Judgment
dispatch" below); the infix convention is documented for the next one that's
authored.

## Intent JSON fields

```jsonc
{
  "kind": "hook",                      // const
  "intent": "session-start",           // category enum (see below)
  "name": "session-start",             // ^[a-z][a-z0-9-]*$, matches filename base
  "description": "…",                  // 1–512 chars
  "visibility": "internal",            // internal | public
  "platforms": ["claude", "opencode"], // non-empty subset of supported hosts
  "trigger": { "matcher": "…", "paths": ["…"] }, // optional host-agnostic hints
  "x-claude":  { … },                  // required when platforms ⊇ claude
  "x-opencode":{ … }                   // required when platforms ⊇ opencode
}
```

### `intent` enum

`session-start`, `pre-compact`, `post-compact`, `instructions-loaded`,
`prompt-type`, `agent-type`.

Command intents map one-to-one to a host event. The two judgment categories —
`prompt-type` and `agent-type` — are keyed by `name` (D10) and bind to
`PreToolUse`.

## Claude binding (`x-claude`)

```jsonc
"x-claude": {
  "event": "PreToolUse",       // see event enum below
  "matcher": "Edit|Write",     // optional matcher string
  "dispatch": "command",       // command | prompt | agent
  "command": ".claude-plugin/hooks/<name>.sh",  // required when dispatch=command
  "prompt": "… $ARGUMENTS …",  // required when dispatch=prompt|agent
  "model": "…"                 // optional, for prompt|agent
}
```

Event enum (verified against `references/claude-code-docs/docs/hooks.md`, D2):
`SessionStart`, `PreToolUse`, `UserPromptSubmit`, `PreCompact`, `PostCompact`,
`InstructionsLoaded`. No shipped intent currently binds `PreToolUse` or
`UserPromptSubmit`; both stay in the enum as permitted-not-required
forward-compat entries for the next `prompt`/`agent`-dispatch judgment hook.
`FileChanged` and `CwdChanged` remain in the schema enum too — no shipped
intent binds them as of v0.1.3; both were removed as non-functional (neither
could deliver its intended effect: `FileChanged`'s matcher only accepts
literal filenames, and both events' `additionalContext` output is not
injected into the model).

### Dispatch types

- **`command`** — runs a script under `.claude-plugin/hooks/`. The projector
  prefixes `${CLAUDE_PLUGIN_ROOT}/` and stamps `aegis-hook-version:` on the line
  after the shebang.
- **`prompt`** — an inline judgment prompt the host evaluates. Carry the literal
  prompt in `x-claude.prompt` with the `$ARGUMENTS` placeholder for the hook
  input JSON (D5). The judgment responds with strict JSON: `{"ok": true}` allows,
  `{"ok": false, "reason": "…"}` denies.
- **`agent`** — spawns an ad-hoc subagent from a prompt string (D4). There is
  **no field to name a pre-defined subagent** — the prompt may reference a skill
  or checklist in prose, but cannot invoke a named agent.

### Event → dispatch support table (D3)

This is a hard constraint the validator enforces — a binding that pairs an
unsupported dispatch with an event is rejected.

| Event | Allowed dispatch |
|---|---|
| `SessionStart` | `command` only |
| `PreToolUse` | `command`, `prompt`, `agent` |
| `UserPromptSubmit` | `command`, `prompt`, `agent` |
| `PreCompact` | `command` only |
| `PostCompact` | `command` only |
| `InstructionsLoaded` | `command` only |

So `prompt-type` and `agent-type` judgment hooks bind to `PreToolUse`; the
compaction and instructions intents are all `command` dispatch.

## OpenCode binding (`x-opencode`)

```jsonc
"x-opencode": {
  "event": "session.compacting",  // session.start | session.compacting | chat.messages.transform
  "phase": "pre",                 // required when event=session.compacting (pre|post)
  "handler": "aegisCompaction"    // handler in .opencode/plugins/aegis.js
}
```

OpenCode has no LLM-evaluated hook primitive, so `prompt`/`agent` Claude judgment
hooks have no OpenCode counterpart — they would ship Claude-only and be listed
as gaps in `adapters/opencode/projection.md`.

## Judgment dispatch (`prompt-type` / `agent-type`)

The `prompt-type` and `agent-type` intent categories exist in the schema and the
event→dispatch support table for `PreToolUse` judgment hooks, but Aegis ships no
hook using either category today — a `command`-dispatch hook covers every
currently-shipped intent (`session-start`, `pre-compact`, `post-compact`,
`instructions-loaded`). A future judgment hook is free to
use them; see "Adding a new intent" below.

## Adding a new intent — the loop

1. **Schema enum.** Add the new category to the `intent` enum in
   `manifest/schemas/hook-intent.schema.json` (and any conditional rules it needs).
2. **Canonical files.** Author `hooks/<name>.json` (+ `hooks/<name>.md` when the
   D1 rules require it). Pick the host bindings; honor the event→dispatch table.
3. **Validator keys.** If the new intent has a script, place it under
   `.claude-plugin/hooks/` so the command-existence check passes. If it is a
   `prompt-type`/`agent-type` judgment hook, remember the adapter matrix keys on
   `name`, not `intent`.
4. **Projection rule.** If the intent maps to an event the projector does not yet
   group, extend `generateClaudeHooksBlock()` / the OpenCode bridge in
   `scripts/project.mjs` (and mirror the change in the validator's drift check).
5. **Adapter rows.** Add a row for the intent to every
   `adapters/<host>/projection.md` hook-capability matrix — `supported`,
   `partial`, or `gap` with an honest note. The `HOOK_INTENT` rule hard-fails if
   any shipped intent lacks a per-host row.
6. **Capability row.** Add a `hooks`-category row to `manifest/capabilities.json`
   and run `node scripts/sync-capabilities.mjs` to regenerate the capability docs.
7. **Validate.** `node scripts/project.mjs && node scripts/validate-structure.mjs`.
   The projector must be idempotent (two runs produce identical bytes) and the
   plugin.json hooks block must match what the validator regenerates in memory.

## Validation summary

The `HOOK_INTENT` rule checks: schema shape and enums, host-binding completeness,
the event→dispatch support table, `.json`/`.md` pairing, command-file existence,
compaction `pre` ⇔ `post` symmetry, per-host adapter gap coverage, and
`plugin.json` drift (it regenerates the expected Claude hooks block and compares
it to the committed file). It also hard-fails if any intent carries an `enabled`
field — a hook either ships or is deleted. All checks are hard-fail.
