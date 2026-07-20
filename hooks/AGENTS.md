# hooks — Agent Guidance

## Purpose

`hooks/` holds **portable hook intents** — what should happen on a given lifecycle event, host-agnostically.

Each host's implementation lives in its native location (`.claude-plugin/hooks/`, `.opencode/plugins/*.js`, etc.), not here.

## Flat layout + `.json`/`.md` pairing

The folder is **flat**: `hooks/<name>.json` (+ optional `hooks/<name>.md`). The old `sessions/`/`tools/`/`prompts/` subdirectory sketch is **superseded** — there are no subfolders. The projector and the `HOOK_INTENT` validator glob `hooks/*.json` non-recursively.

- `hooks/<name>.json` — the **machine binding** and source of truth for projection. Validated by the `HOOK_INTENT` rule (`scripts/validate/hook-intent.mjs`), which is **hand-rolled and loads no schema file**: Aegis ships zero dependencies, so there is no validator to execute JSON Schema with. `manifest/schemas/hook-intent.schema.json` documents the contract for humans and stays in sync by review, not by enforcement — the rule is the only gate. The projector (`scripts/project.mjs`) builds the Claude `.claude-plugin/plugin.json` `hooks` block and the OpenCode compaction region in `.opencode/plugins/aegis.js` from these.
- `hooks/<name>.md` — the **human intent doc** (lean 4-field frontmatter: `name`, `description`, `visibility`, `platforms` — `kind` is retired per Iron Law 3, and these docs are checked by the `FRONTMATTER` rule like any other canonical surface). When both files exist, `json.name` MUST equal `.md` frontmatter `name`.

`.md` is **required** when dispatch is `prompt`/`agent`, or the intent is `pre-compact`/`post-compact`. It is **optional** for pure command hooks (`session-start`, `instructions-loaded`).

## Intent JSON shape (authoritative: `manifest/schemas/hook-intent.schema.json`)

```jsonc
{
  "kind": "hook",
  "intent": "session-start",            // category enum (see schema)
  "name": "session-start",              // ^[a-z][a-z0-9-]*$, matches filename
  "description": "…",
  "visibility": "internal",
  "platforms": ["claude", "opencode"],
  "x-claude": {                          // required when platforms ⊇ claude
    "event": "SessionStart",
    "matcher": "startup|clear|compact",
    "dispatch": "command",               // command | prompt | agent (D3 support table)
    "command": ".claude-plugin/hooks/session-start.sh",
    "helpers": []                        // optional: shared libs this hook sources
  },
  "x-opencode": {                        // required when platforms ⊇ opencode
    "event": "experimental.chat.messages.transform",
    "handler": "bootstrap"
  }
}
```

`x-opencode.event` is the **literal flat dotted hook key** OpenCode resolves the handler by — verified against the installed `@opencode-ai/plugin` type contract (`dist/index.d.ts`, OpenCode 1.18.3), where every one of these is declared as a quoted dotted property on the `Hooks` interface. The projector emits the value verbatim as the generated key string. A nested binding (`experimental: { session: { compacting } }`) declares a *different* property, so the handler is registered and never invoked — with no error. Two intents may not bind the same key: the generated handler object is a JS object literal, where a duplicate key silently wins and the loser never fires. Both rules are `HOOK_INTENT` hard-fails.

`prompt`/`agent` dispatch carry `x-claude.prompt` (+ optional `model`) — **not** an agent-name (D4). `command` dispatch carries `x-claude.command` under `.claude-plugin/hooks/`, plus an optional `x-claude.helpers` array naming the shared libraries that script sources (see the prune section below).

`platforms` accepts `claude` and `opencode` for hooks. **`codex` is rejected** — see the note below the prune section.

## `.claude-plugin/hooks/` is flat

The implementation tree is **flat** — `x-claude.command` must match `^\.claude-plugin/hooks/[^/]+$` (schema + `HOOK_INTENT`). No subdirectories.

`projectHooks()` prunes this directory on every run: any entry no live intent references via `x-claude.command` **or declares in `x-claude.helpers`** is deleted, so a retired hook cannot leave its script shipping inside the plugin. Two consequences follow from that, and both are load-bearing:

- **A directory raises, it is never removed.** The prune refuses to descend, because reaping a subtree could take a correctly-referenced script down with it. A directory here is an authoring error — fix the path, don't nest.
- **Helper files are protected by declaration, not by spelling.** A shared library sourced by hook scripts (`lib.sh`, sourced as `source "$(dirname "$0")/lib.sh"`) has nothing binding it via `x-claude.command` by design. Declare it in the sourcing hook's `x-claude.helpers` array and the prune keeps it:

  ```json
  "x-claude": {
    "event": "SessionStart",
    "dispatch": "command",
    "command": ".claude-plugin/hooks/session-start.sh",
    "helpers": ["lib.sh"]
  }
  ```

  Entries are bare filenames (the tree is flat). A declared helper that does not exist on disk is a hard error, and an undeclared file is pruned. There is no naming convention to remember: a file survives because an intent *claims* it, never because of how it is spelled.

Every pruned path is printed to stdout. A deletion is never silent.

**`.claude-plugin/hooks/` has consumers that must agree, and the keep-set is what binds them.** The projector's destructive prune (`projectHooks()`, `scripts/project.mjs`), the `HOOK_INTENT` orphan rule and its command-existence check (`scripts/validate/hook-intent.mjs`), and the catalog row in `docs/validators.md` all describe the same contract. The prune and the orphan rule do not merely agree by convention — they call one exported function, `hookTreeKeepSet()` in `scripts/lib/hook-projection.mjs`, so they cannot drift into the projector deleting a file the validator demands. Change what belongs in this tree by changing that function, and check the doc rows in the same commit.

> **No Codex hook tree.** Aegis does not project hooks to Codex at all — `plugin_hooks` is removed upstream, and `codex` is a **rejected** value in a hook intent's `platforms` (both `HOOK_INTENT` and the projector hard-fail on it). See `adapters/codex/projection.md` for the gap and what re-adding would cost.

## Intent doc frontmatter (`<name>.md`)

```yaml
---
name: session-start
description: Bootstrap Aegis discovery and rules at session start.
visibility: internal
platforms: [claude, opencode]
---
```

## Deferred / unimplemented events (honest gaps)

Some lifecycle events are recognized but **not yet bound by any Aegis intent**. Recorded here as honest gaps (Iron Law #6), not silently dropped:

- **`UserPromptSubmit`** — present in the `x-claude.event` enum of `manifest/schemas/hook-intent.schema.json` for forward-compatibility, but **no `hooks/*.json` intent uses it**. Status: **reserved/deferred**. Kept in the enum because removing a schema enum entry is a wider blast radius than documenting it; a future prompt-stage intent can bind it without a schema change.
- **`MessageDisplay`**, **`AgentStart`**, **`AgentEnd`** — host events with **no Aegis intent and no schema enum entry**. Status: **unimplemented/deferred**. No portable intent currently maps to them; if a future capability needs one, add the enum entry and a `hooks/<name>.json` binding in the same change.

These are tracked deferrals, not bugs. The `HOOK_INTENT` validator does not require an intent per event — it validates the intents that *do* exist against the contract.

## Rules

- Never vendor Anvil's `.ts` or `.cjs` hooks into Aegis. Those expect Anvil's TS runtime, which Aegis does not have.
- Hooks must be expressible as a `.json` binding (+ optional one-page `.md` intent doc) plus per-host implementations.
- Per-host implementations live in the host's native location, NOT here.
- The generated host files (plugin.json `hooks` block, aegis.js `AEGIS:HOOKS-GEN` region) are projector-owned — never hand-edit them; edit the canonical `.json` and re-run `node scripts/project.mjs`.
- Aegis is plugin-first — hooks must work without a binary install.

## Hook-authoring hardening

Battle-tested rules for any shipped hook implementation under `.claude-plugin/hooks/*`. Sources: oh-my-claudecode, ECC, claude-code-docs, agentmemory (2026-06-14 reference-refresh audit, O-7/O-12).

1. **Universal opt-out.** Every non-security hook honors a global kill-switch plus a per-hook token, as its first executable lines (shell form, safe under `set -e`):

   ```bash
   if [ "${AEGIS_DISABLE:-}" = "1" ]; then exit 0; fi
   case ",${AEGIS_SKIP_HOOKS:-}," in *",<hook-name>,"*) exit 0 ;; esac
   ```

   `AEGIS_DISABLE=1` disables all Aegis hooks; `AEGIS_SKIP_HOOKS=session-start,instructions-loaded` disables named ones. Applied to every shipped hook — there is no security-boundary exception today.

2. **Fail open; always exit 0 (advisory + lifecycle hooks).** Any internal error → exit 0 with no output ("no opinion"), never crash the user's turn. On oversized or truncated stdin, emit empty stdout + exit 0 — never echo a mid-stream-truncated JSON payload.

3. **Flush stdout before exit (Node hooks).** Write through the callback before `process.exit()` — a bare exit can truncate output past the ~64 KB pipe buffer (ECC #2222).

4. **Advisory Stop/SubagentStop hooks must suppress output.** A Stop/SubagentStop hook that returns `hookSpecificOutput.additionalContext` re-injects that text into the finishing subagent; advisory terminal hooks set `suppressOutput` and emit no `additionalContext` (OMC #3233). *Forward-looking — Aegis ships no Stop/SubagentStop hook today.*

5. **`async: true` on terminal long-tail hooks.** SessionEnd-class fire-and-forget hooks mark `async: true` so they don't block shutdown (OMC #3240). Distinguish telemetry-only hooks (unawaited, hard latency bound, never block the prompt boundary) from context-injecting hooks (awaited, timeout-bounded) — agentmemory #688. *Forward-looking — Aegis ships no SessionEnd hook today.*

6. **Project key = git basename.** A project-scoped hook resolves the project as `AEGIS_PROJECT_NAME` env → `git rev-parse --show-toplevel` basename → `basename(cwd)`, never a raw full-path match (which silently filters by cwd) — agentmemory #687.

7. **"Am I inside Claude" detection.** If a hook or statusline ever needs to detect a Claude session, prefer `CLAUDE_CODE_CHILD_SESSION` (true only in Claude-spawned subprocesses) over `CLAUDECODE` (false-positives in IDE/tmux/MCP terminals) — cc-docs `env-vars.md:137`. *No Aegis runtime gates on this today; rule applies when one is added.*

8. **Match the decision to the kind of rule: `deny` for invariants, `ask` for preference.** `deny` fires ahead of any permission mode and cannot be bypassed even with `--dangerously-skip-permissions`, so it is correct only where the decision is genuinely not the user's to make per call — secret reads, `rm -rf /`, force-push, `reset --hard`, working-tree discards. A workflow *preference* gated with `deny` becomes a standing tax: the user's only escape is prefixing an override on every invocation forever. Use `ask` there instead — it surfaces the normal permission prompt and the user decides per call, with no plugin-internal config to edit. Aegis ships no hook using either decision today; this is forward guidance for the next one that's authored.

9. **Classify from the command, never from resolved session state.** A hook sees the tool-call JSON, and its `cwd` is the session's working directory — NOT the directory the command runs in. Anything derived from it (current git branch, current repo) is wrong whenever the command `cd`s first, which is the normal case in a multi-worktree repo. A future command-inspecting hook should check only destinations named IN the command itself, never resolve and match against the current branch. A check that cannot be made sound is dropped, not approximated.
