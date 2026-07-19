# scripts — Agent Guidance

## Purpose

`scripts/` holds maintainer-only Node scripts for inventory, validation, projection, and diagnostics. These are NOT user-facing — Aegis users never run them.

## Iron Rule: 30-Second Validation Ceiling

`scripts/validate-structure.mjs` MUST complete in under 30 seconds, ALWAYS. Anvil's test suite reaches 20 minutes — that is the failure mode we are explicitly avoiding.

If validation runtime grows past 5 seconds, audit:

- Are we walking `node_modules`? (We shouldn't be.)
- Are we walking `references/`? (We shouldn't be.)
- Are we re-reading the same file? (Cache it.)
- Are we adding regex-heavy passes when a single walk would suffice?

The script enforces a hard 30s ceiling at the end. Exceeding it causes a build-level error, not a warning.

## Rules

- Use Node 20+ standard library only. No npm dependencies.
- No Bun. No TypeScript compilation. Plain ESM `.mjs`.
- Output JSON when machine-readable; human-friendly text only for `doctor.mjs`.
- Scripts are idempotent — running twice produces identical results (except for elapsed-ms).
- If a script writes anything, write only inside the repo or `.aegis/`.

## Files

- `inventory.mjs` — counts canonical surfaces. Emits JSON.
- `validate-structure.mjs` — thin entry; imports `validate/index.mjs`. Keep it one line.
- `validate/index.mjs` — orchestrator: builds shared ctx once, runs rule modules in section order, enforces the 30s ceiling, prints/exits. Add a rule via one import + one `RULES` entry.
- `validate/_context.mjs` — shared context built once: single `walk()`, `rel`, memoized `read`, `fmSplit`, `fmTopKeys`, `stripFences`.
- `validate/*.mjs` — one rule module per check section, each exporting `id` + `run(ctx) -> {errors, warnings}`: `root-files`, `sparse-guidance`, `frontmatter`, `manifest`, `statusline`, `templates`, `codex`, `plugin-manifests`, `hook-intent`, `codex-agents`, `permissions`, `capabilities`, `claude-drift`, `capability-docs-sync`. v0.0.6 warn-only rules: `tool-name-leak` (`TOOL_NAME_LEAK`), `agent-name-collision` (`AGENT_NAME_COLLISION`), `skill-body-long` (`SKILL_DESC_LONG`; the body-size half moved to `skill-size` in v0.0.14), `skill-size` (`SKILL_SIZE`, sole owner of the >100-line body cap), `bucket-readme` (`BUCKET_README_MISSING`), `lockfile` (`SKILL_LOCK_MISSING`). Note: `skill-codex-cap` (`SKILL_OVER_CODEX_CAP`) was removed in v0.2.0 (AG-0233 D-01) — the per-body 8 KB cap was bogus. v0.1.2 warn-only rule: `description-shape` (`DESCRIPTION_SHAPE`, flags an arrow or conjugated process verb — `runs `/`emits `/`orchestrates `/`dispatches ` — in a `description:`; graduates to hard-fail in v0.1.3).
- `validate/hook-intent.mjs` (`HOOK_INTENT`, AG-0010 D9) — HARD-FAIL contract validator for `hooks/*.json`. Checks schema shape, the event→dispatch support table (D3), `.json`/`.md` pairing (D1), command-file existence, compaction pre⇔post symmetry, and plugin.json drift (regenerates the expected Claude hooks block in-memory via the shared `generateClaudeHooksBlock()` from `lib/hook-projection.mjs` — the same function the projector uses, no mirror — and compares to the committed `.claude-plugin/plugin.json`). The per-host adapter gap-coverage check is **HARD-FAIL** as of v0.0.7 Phase E: every shipped intent must have a hook-matrix row in every `adapters/<host>/projection.md` (keyed by name for judgment hooks, by intent otherwise). Stdlib-only, no ajv.
- `lib/validate-permissions.mjs` — importable permission-drift validator (D7); pure, `validatePermissions(REPO)`.
- `lib/collision-names.mjs` — name-collision + reserved-name helpers across skills/agents/commands (`collectAgentNames`, `findNameCollisions`, …). Consumed by `agent-name-collision`.
- `lib/atomic-write.mjs` — `atomicWrite(path, contents)`: UUID-suffixed tmpfile → fsync → atomic rename. Used by hook version-stamping in `project.mjs`.
- `lib/subagent-primitives.mjs` — `validateSubagentPrimitive(k, v)` / `assertIsolationWritable(name, tools)`: shared validation+coercion for the four native `x-claude` subagent execution-profile fields (`effort`/`isolation`/`maxTurns`/`background`, AG-0263). Accepts both parser-typed strings and native types; returns the coerced value. Imported by `project.mjs`'s `flattenXClaude()` and exercised directly by `tests/subagent-primitives-projection.test.mjs`.
- `lib/hook-projection.mjs` — shared Claude hooks-block generator (AG-0010 D6). Exports `generateClaudeHooksBlock(intents)` (+ `dispatchObjectFor`, `EVENT_ORDER`): builds the `.claude-plugin/plugin.json` `hooks` object from canonical intents (grouped by `x-claude.event`, name-sorted, `enabled:false` excluded per D7, `${CLAUDE_PLUGIN_ROOT}/`-prefixed commands). Pure, no I/O. **Single source of truth** — both `project.mjs` (projection) and `validate/hook-intent.mjs` (drift check) import it, so the generator and its validator can never drift out of sync (there is no mirror).
- `lib/settings-merger.mjs` — `mergeSettings(existingText, patch)`: JSONC-tolerant merge preserving comments + trailing commas on untouched regions (inserted keys emitted via JSON.stringify — documented gap in the header).
- `validate-prose.mjs` — standalone LLM-cliché linter against `docs/style-guide.md` denylist; warn-only (exit 0), `--strict` reserved for v0.0.7. Scans skills/agents/commands/rules/docs prose, skips fenced code.
- `validate-counts.mjs` — standalone surface-count drift gate; shells out to `inventory.mjs`, compares against count claims in README/root AGENTS.md/docs/architecture.md. Hard-fails on drift.
- `secret-scan.sh`, `base64-scan.sh`, `prompt-injection-scan.sh`, `unicode-safety-scan.sh`, `personal-paths-scan.sh` — stdlib-bash security scanners (secrets, long base64 blobs, prompt-injection phrases, zero-width/bidi Unicode, hardcoded personal paths). Non-zero exit on hit. Mandated per PR; see `docs/security.md`. The latter two added AG-0231 (v0.1.0): unicode-safety scans all shipped surfaces for zero-width/bidi (Trojan Source) only (AG-0237 relaxed the emoji ban — purposeful emoji are now allowed); personal-paths flags `/home/<you>` / `/Users/<you>` in shipped content (placeholders + `aegis-allow-*-sample` markers exempt).
- `eval/three-arm-baseline.mjs` — static-lint acceptance harness (AG-0011, v0.1.2): loads `eval/fixtures/*.json`, asserts required fields are present and every `expectRoutesTo` path exists in the repo, prints PASS/FAIL per fixture, exits non-zero on any failure. No API/network calls (LLM-Judge/Monte-Carlo arms remain deferred). See `scripts/eval/README.md`.
- `project.mjs` — regenerates host-specific generated files from canonical. v0.0.1 stub; expanded per release. AG-0010 (v0.0.7) added portable-hook-intent projection: `loadHookIntents()` globs+hand-validates `hooks/*.json`; the plugin.json `hooks` object is built by the shared `generateClaudeHooksBlock(intents)` imported from `lib/hook-projection.mjs` (grouped by `x-claude.event`, `${CLAUDE_PLUGIN_ROOT}/`-prefixed commands, enabled:false excluded per D7); `regeneratePluginJson(skills, agents, hookIntents)` folds `hooks` + `userConfig.promptInjectionScanner` into the generated set; `hookFilesFromIntents(intents)` derives the auto-stamp file list so every command hook re-stamps; `injectOpencodeCompactionBridge(text, intents)`/`projectOpencodeHooks()` rewrite the guarded `AEGIS:HOOKS-GEN` region in `.opencode/plugins/aegis.js` (idempotent; Phase A ships a no-op placeholder, Phase B fills the body).
- `template-query.mjs` — maintainer-only template introspection over `manifest/template-index.json` (AG-0218, v0.0.14). Answers the three discovery questions as JSON on stdout: `--kinds-supporting <html|markdown|json>` (which kinds ship a format), `--formats <kind>` (a kind's formats map + default), `--slots <kind> [--format <f>]` (a kind's slot manifest, read from the body's sibling `.template.json`), `--list` (all kinds). Reads the existing contract only, writes nothing; non-zero exit on unknown kind/format. NOT a user CLI (Iron Law 1). Usage documented in `docs/templates.md`.
- `doctor.mjs` — runs inventory + validate + summary.
- `gate.mjs` — one-shot ready-to-push check (`npm run gate`): runs `validate-structure` + `validate-counts` + `test-projection` + `test-deny-hook` + `doctor` + every `tests/*.test.mjs` + the five security scanners in sequence; prints PASS/FAIL per step and exits non-zero on any failure. This is the single entry point CI runs.
- `sync-capabilities.mjs` — regenerates `docs/harnesses.md` (generated block) + `docs/capability-matrix.md` from `manifest/capabilities.json`. `--check` exits non-zero on drift. Idempotent.
- `build-dist-zip.mjs` — builds `dist/aegis.skill`, a reproducible ZIP of the projected Claude plugin tree (stdlib-only ZIP writer, deterministic order/mtimes). On-demand only.
- `test-projection.mjs` — dependency-free TAP-ish runner for projection (x-claude/x-opencode extraction) and permissions golden-output assertions. Exits non-zero on any failure.
- `test-deny-hook.mjs` — regression test for the PreToolUse deny hook (`.claude-plugin/hooks/pre-tool-use-deny.sh`); 22 deny/allow cases. Requires bash + jq.
- `tests/` — per-feature unit tests (dependency-free, TAP-ish, same runner shape as `test-projection.mjs`). `tests/hook-intent.test.mjs` exercises the `HOOK_INTENT` validator against throwaway temp-dir fixtures (valid intent, missing field, unknown event, D3/D4/D7 violations, host-binding completeness, plugin.json drift). Run: `node scripts/tests/hook-intent.test.mjs`. `tests/projection-hooks.test.mjs` (AG-0010 B3 + C4) hashes the committed generated files (`.claude-plugin/plugin.json`, `.opencode/plugins/aegis.js`), runs `node scripts/project.mjs` twice as a subprocess, and asserts the bytes are unchanged (idempotency); asserts plugin.json's hooks block carries the expected event bindings (SessionStart, PreToolUse deny command, PreCompact, PostCompact, InstructionsLoaded) and aegis.js contains the `AEGIS:HOOKS-GEN` region; and (C4, via the extracted `generateClaudeHooksBlock`) asserts prompt/agent dispatch shaping, the `enabled:false` exclusion, that opencode/codex-only hooks never produce a Claude prompt/agent entry, and that the four shipped judgment hooks are `platforms:[claude]` + `enabled:false`. Run: `node scripts/tests/projection-hooks.test.mjs`. `tests/memory-projection.test.mjs` (AG-0236) asserts the `x-claude.memory` projection: (M1) `build-error-resolver` Claude generated frontmatter carries `memory: project`; (M2) OpenCode copy does NOT carry `memory:`; (M3) invalid scope throws; (M4) guard throws for a memory-bearing agent whose permissions disallow Write; (M5) guard passes for `build-error-resolver`; (M6) Codex copy does not carry `memory:`. Run: `node scripts/tests/memory-projection.test.mjs`. `tests/description-shape.test.mjs` (AG-0010, v0.1.2) exercises the `DESCRIPTION_SHAPE` validator against a minimal ctx stub over temp-dir fixtures: BAD fixtures (arrow, conjugated verb, both) each produce exactly one warning and never an error; GOOD fixtures (pure trigger, em-dash gloss house style, `dispatch`-as-noun) produce zero warnings. Run: `node scripts/tests/description-shape.test.mjs`.

## Adding a New Script

1. Justify it in a release plan task or feature spec.
2. Keep it under 200 lines if possible.
3. Stay dependency-free.
4. Update this file when adding.
