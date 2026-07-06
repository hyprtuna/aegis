# Subagent statusline contract

Claude Code's `subagentStatusLine` setting renders a custom row body for each
subagent shown in the agent panel below the prompt. It is the parallel of the
main `statusLine` and is gated by the **same workspace-trust acceptance and the
same `disableAllHooks` setting** — if either disables the main statusline, the
subagent statusline is disabled too.

## Invocation

```json
{
  "subagentStatusLine": {
    "type": "command",
    "command": "node /path/to/<preset>/subagent.mjs"
  }
}
```

The command runs **once per refresh tick** with **all visible subagent rows
passed as a single JSON object on stdin** (not one invocation per row).

## Input payload (stdin)

The payload includes the standard hook base fields plus:

| Field      | Description                                                                 |
| ---------- | --------------------------------------------------------------------------- |
| `columns`  | Usable row width (integer). Use instead of `COLUMNS` for per-row budgeting.  |
| `tasks`    | Array of visible subagent rows (see below).                                 |

Each entry in `tasks[]` carries:

| Field          | Description                                                  |
| -------------- | ------------------------------------------------------------ |
| `id`           | Stable task id. **Required** to address a row in the output. |
| `name`         | Subagent name.                                               |
| `type`         | Subagent / task type.                                        |
| `status`       | Current status (e.g. running, done).                         |
| `description`  | Task description.                                            |
| `label`        | Short label.                                                 |
| `startTime`    | Start timestamp.                                             |
| `tokenCount`   | Tokens consumed so far.                                      |
| `tokenSamples` | Recent token-rate samples.                                   |
| `cwd`          | Working directory for the task.                              |

This `tasks[]` shape is **documented** in `statusline.md` (the subagent section)
and is treated as authoritative. Fields beyond `id` should be accessed
defensively — any may be absent on a given tick.

## Output (stdout)

Write **one JSON line per row you want to override**, each of the form:

```json
{"id": "<task id>", "content": "<row body>"}
```

- `content` is rendered as-is, including ANSI colors and OSC 8 hyperlinks.
- **Omit a task's `id`** (i.e. emit no line for it) to keep the default row.
- Emit an **empty `content`** string to hide that row.

## Aegis runtime mapping

`subagent-runtime.mjs` reuses the bulletproof wrapper from `runtime.mjs`
(400ms stdin timeout, sanitize, `process.exit(0)` in `finally`, `[Aegis]`
fallback). Instead of composing descriptor lines, it iterates `tasks[]` and
emits one `{"id","content"}` JSON line per task, with every interpolated string
sanitized for C0 control characters.

## Cross-host gap

Only Claude Code documents a `subagentStatusLine`. OpenCode, Codex, Cursor, and
Zed have no equivalent at v0.0.4 — this is an honest gap recorded in the
per-adapter projection notes, not silently dropped.
