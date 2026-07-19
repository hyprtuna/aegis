# statuslines — Agent Guidance

## Purpose

`statuslines/` is the **canonical** source for Aegis statusline presets and the
shared runtime that renders them. A statusline is a customizable bar Claude Code
runs after each assistant turn, fed a JSON session payload on stdin (see
`references/claude-code-docs/docs/statusline.md`).

Canonical lives here. `adapters/claude-code/statuslines/` is **generated** by
`scripts/project.mjs` — never hand-edit the adapter copy.

## Layout

```
statuslines/
  _shared/
    runtime.mjs            # bulletproof main-statusline runtime + ctx + compose
    subagent-runtime.mjs   # bulletproof subagentStatusLine runtime
    subagent-contract.md   # the subagentStatusLine JSON contract
    themes/
      loader.mjs           # palette load + validate + colorize() helper
      <name>.json          # palettes: mono, default, tokyo-night, gruvbox-dark
    segments/
      <id>.mjs             # one module per segment ID, exports render(ctx)
    tests/runtime.test.mjs # node --test, asserts exit 0 + non-empty stdout
  <preset>/statusline.json # preset descriptors (owned per-preset; not in _shared)
```

## Bulletproof-runtime mandate (non-negotiable)

Claude Code blanks the statusline on a non-zero exit, empty stdout, or a slow
script. Therefore the runtime **always**:

- reads stdin with a 400ms timeout;
- on JSON parse failure emits `[Aegis]` and exits 0;
- wraps all rendering in try/catch and `process.exit(0)` in a `finally`;
- sanitizes every interpolated stdin string (strips ALL C0 control chars
  including ESC and TAB, plus DEL) — ANSI colour and OSC-8 links are emitted by
  trusted code (`loader.colorize`, `pr.mjs`) which adds its own ESC after the
  payload is sanitized, so a hostile branch name / PR url cannot inject escapes;
- never emits wholly empty stdout (falls back to `[Aegis]`);
- writes nothing to stderr.

A broken individual segment must never take down the whole bar — `compose()`
catches per-segment errors and drops the offending segment.

## Conventions

- **Node 18+ built-ins only.** No dependencies, no build step, plain `.mjs` ESM.
- **Descriptor schema:** `manifest/schemas/statusline.schema.json`. `segments`
  is an array of *lines*; each line is an ordered array of segment-ID strings.
- **Theme schema:** `manifest/schemas/statusline-theme.schema.json`. Color
  values are named-ANSI, a 256-color integer, or `#rrggbb` hex. `mono` = no
  color except a dimmed `label`.
- **Segment contract:** each `segments/<id>.mjs` exports `render(ctx)` returning
  `string | null` (null → renders nothing). The `ctx` shape and the runtime
  argv contract are documented at the top of `runtime.mjs` — read it before
  adding a segment.
- **`pr` segment** reads only native JSON (`pr.{number,url,review_state}`,
  `workspace.repo.*`). No `gh`/`git` subprocess. `pr` and `pr.review_state` are
  independently optional.
- **Honest gaps:** several segments (`prompt-cache`, `tools`, `todos`) have no
  documented Claude Code payload field. They read an optional field defensively
  and render null until the host surfaces it. The gap is recorded in each module
  header and in `adapters/claude-code/projection.md`.

## Composability (all optional, additive)

The preset descriptor schema (`manifest/schemas/statusline.schema.json`) gained
four OPTIONAL composability fields. A descriptor that declares none behaves
exactly as before; every preset predating this composability layer still validates and renders
unchanged. The runtime honors them in `_shared/runtime.mjs` (`compose()` +
`buildCtx()`); the validator (`scripts/validate/statusline.mjs`) checks them.
The `statuslines/composable/` preset is the worked reference that exercises all
four.

- **`order`** — explicit segment-priority list. When present, every line's
  `segments` are STABLE-SORTED by their index in `order`; segments absent from
  `order` keep their authored relative position and sort after listed ones. It
  only reorders within a line — never adds or removes a segment. Validator: each
  entry is a known segment ID, unique, and present in `segments`.
- **`mergeGroups`** + **`mergeSeparator`** — `mergeGroups` is an array of
  segment-ID groups (>=2 each); two ADJACENT rendered segments in the same group
  are joined by `mergeSeparator` (default `""`) instead of the normal ` · `
  separator. A segment may be in at most one group. Use it to render e.g. git+pr
  as `⎇ feat/PR #42`. (Reordering via `order` happens BEFORE merge adjacency is
  evaluated.)
- **`thresholds`** — per-metric ordered breakpoints (authored high→low) mapping a
  numeric value to a theme color KEY (`warning`, `critical`, …) and an optional
  severity `label`. The runtime exposes `ctx.threshold(metric, value)` →
  `{ color, label } | null` (first `at` <= value wins; null when no metric/match).
  Segments OPT IN by calling it to escalate their color/severity; segments that
  ignore it render as before.
- **`i18n`** — `{ locale?, labels }`. The runtime exposes `ctx.t(key)` returning
  `labels[key]` or the key itself when absent. Segments OPT IN by looking up
  their label slugs through `ctx.t`. `locale` is advisory metadata
  (BCP-47-ish, e.g. `en`, `pt-BR`); the runtime keys off `labels` directly.

`ctx.t` and `ctx.threshold` are ALWAYS present on the ctx (no-op identity /
null-returning when the descriptor omits the field), so a segment can call them
unconditionally without guarding.

## Running tests

```bash
node --test "statuslines/_shared/tests/*.test.mjs"
```

Use the explicit glob. On Node 24 a bare directory argument is treated as a
module entry point, not a test glob, so `node --test statuslines/_shared/tests/`
fails to discover the suite there. Every test asserts exit code 0 and non-empty
stdout — keep that invariant when adding cases.

## Cross-host gap

Currently only **Claude Code** has a real statusline projection. OpenCode,
Codex, Cursor, and Zed have no native statusline (and no `subagentStatusLine`)
equivalent — preset descriptors stay host-agnostic so a future hook can render
them, but the gap is explicit, never silently dropped.

## Forbidden

- Editing the generated `adapters/claude-code/statuslines/` copy.
- Adding a build step, TypeScript, Bun, or any npm dependency.
- Placing `AGENTS.md`/`CLAUDE.md` anywhere under `statuslines/` except this root.
