# Aegis — Agent Guidance (Repo Root)

This file is the source of truth for agents working on the Aegis repository. `CLAUDE.md` is a one-line stub that imports this file.

## Mission

Aegis is a plugin-first agentic AI dev system descended from Anvil. It carries Anvil's content into a portable surface tree that projects natively into Claude Code, OpenCode, Codex, Cursor, and Zed.

## Where Things Live

| What | Where |
|---|---|
| Architecture specs | `docs/specs/` (`aegis-design.md`, `native-tool-contracts.md`, `output-conventions.md`, `tiers.md`) |
| Roadmap | `.aegis/plans/_roadmap.md` |
| Active release plan | `.aegis/plans/v0.0.x-plan.md` (highest x with incomplete checkboxes) |
| Research notes | `.aegis/research/*.research.md` |
| Decision records | `.aegis/specs/features/ag-NNNN-*/decisions.md` |
| Surface schemas | `manifest/aegis.manifest.json` + `manifest/schemas/*.json` |
| User-facing docs | `docs/` |
| Maintainer scripts | `scripts/*.mjs` (node, no Bun) |

> **Two-repo model.** The published architecture specs live in `docs/specs/`. Everything else under `.aegis/` (roadmap, release plans, research, tickets, decision records) is the **private** [`hyprtuna/aegis-internal`](https://github.com/hyprtuna/aegis-internal) planning repo, cloned into `.aegis/` and fully gitignored here. Contributors without that clone will not see those paths.

## Iron Laws

1. **No user CLI.** Aegis is plugin-first. Users do not install a binary. Maintainer-only Node scripts.
2. **Canonical is the source of truth.** `skills/`, `agents/`, `commands/`, `hooks/`, `rules/`, `templates/`. Host-native files (`.claude-plugin/`, `.cursor/rules/`, `.rules`, etc.) are generated or hand-shimmed; never the canonical source.
3. **Lean frontmatter.** 4 fields: `name, description, visibility, platforms`. (`kind` is retired — no host recognised it, the projector already discarded it, and a surface's kind is stated by its directory. The `FRONTMATTER` validator now rejects it.) Plus `source: anvil:<path>` on migrated items. Adapter-specific metadata uses `x-<adapter>` namespace.
4. **Abilities are not skills.** Parent `SKILL.md` is the only registered skill. `abilities/<x>.md` are on-demand fragments — no frontmatter or minimal, NOT registered.
5. **Sparse guidance.** `AGENTS.md` + `CLAUDE.md` only at repo root and at each main surface folder root.
6. **Honest gaps.** Unsupported host capabilities go in `adapters/<host>/projection.md` as explicit gaps, never silently dropped.
7. **Fast validation.** `scripts/validate-structure.mjs` must complete in <30s.

## Workflow for New Work

1. Check the active release plan for incomplete tasks.
2. Read the relevant feature spec under `.aegis/specs/features/`.
3. Implement in canonical paths (`skills/`, `agents/`, etc.).
4. Run `node scripts/validate-structure.mjs` before committing.
5. Update the release plan's task checkboxes.

## Release Workflow

The full release runbook is maintained in the private `aegis-internal` planning repo; the essential rules here are the public summary.

**Pipeline:** pre-flight (clean `main`, plan + tickets exist) → cut `release/v<X.Y.Z>` branch + `.worktrees/release-v<X.Y.Z>` worktree (INLINE) → per-ticket loop (plan → verify → code+gate+commit) → strict reviewer at release granularity → fixers → ship.

**Hard rules (lessons learned — non-negotiable):**
- **Concurrency: 1 subagent at a time by default, 2 absolute ceiling.** The 5-parallel general-orchestration default does NOT apply to release work (a wide fan-out once hit the usage limit). Prompt the owner serial-vs-parallel before implementing unless told to run autonomously.
- **Subagents NEVER push, branch, merge to main, cherry-pick, or tag.** The inline orchestrator (Opus High) is the sole arbiter of branch/network/`main`. Coders/fixers commit ONE conventional commit on the release branch and nothing else.
- **Model routing:** orchestrator + planner + strict reviewer + architecture = Opus High; coder + fixer + ship gate + small tasks = Sonnet.
- **Gate PRE-commit, never post-commit.** The Coder runs the full static gate (`validate-structure` + `test-projection` + the 5 security scans + `project.mjs` re-projection if canonical was touched) and commits only when green.
- **Edit canonical → re-run `node scripts/project.mjs` and commit the generated changes in the same commit.** Never hand-edit a generated host file or hook version stamp.
- **Ship via the 3-step merge split** (`gh pr merge --squash` → `git push origin --delete` → `ExitWorktree`); never `gh pr merge --delete-branch` from inside a worktree. **Tag every release with an ANNOTATED tag** (`git tag -a v<X.Y.Z> -m "v<X.Y.Z> — <theme>" && git push origin v<X.Y.Z>`) — never a lightweight tag, so the whole release-tag series carries a tagger, date, and message consistently.
- **Strict review may be skipped only for provably docs-only releases**, gated by the mechanical override grep (§J of the workflow) — never on declaration alone.

**Post-merge checklist (the Release-Ship Rule):** plan status filled + Definition of Done met; `_roadmap.md` row marked shipped; CHANGELOG section added (stale `[Unreleased]` cleared); version bumped across `package.json` + `.claude-plugin/plugin.json` + `.claude-plugin/marketplace.json` + `manifest/aegis.manifest.json`; then `node scripts/project.mjs` regenerates the Codex manifest (`.codex/plugins/aegis/.codex-plugin/plugin.json`) and marketplace (`.agents/plugins/marketplace.json`) from package.json — do NOT hand-bump those; release tagged.

## Forbidden

- Editing files inside `references/` (read-only).
- Adding `AGENTS.md` or `CLAUDE.md` outside the approved sparse list (validator will reject).
- Adding Bun, TypeScript runtime, or build dependencies (Aegis is plugin-first).
- Hand-editing files generated by `scripts/project.mjs`.
- Duplicating canonical content into `adapters/<host>/`.

## Approved Guidance Folders

Only these folders may contain `AGENTS.md` + `CLAUDE.md`:

```
.
adapters
docs
hooks
manifest
rules
scripts
skills
statuslines
templates
```

**Excluded by design:** `agents/` and `commands/`. Claude Code's plugin loader scans every `.md` file in those folders, so any `AGENTS.md` placed there gets registered as an agent or command and collides with real surfaces. Guidance for those two folders lives in this root file under the per-surface sections below.

`scripts/validate-structure.mjs` enforces this list.

## Surface-Specific Conventions

### `agents/`

Purpose: first-class doers — subagents invoked via the host's Task tool. Flat layout, one `.md` file per agent. Frontmatter is the lean 4-field schema (`name`, `description`, `visibility`, `platforms`). Use `x-claude:` or `x-opencode:` for host-specific overrides. Aegis preserves Anvil's skill/agent pairing (e.g. `code-review` skill + `code-reviewer` agent) — both can coexist; they serve different invocation contexts. **Never** add `AGENTS.md`, `CLAUDE.md`, or any per-host subfolder here.

**Sanctioned agent-only agents (no paired skill).** Agent-only is acceptable per this section — not every agent needs a matching skill. `build-error-resolver`, `code-architect`, and `code-explorer` are intentionally agent-only focused doers; their lack of a paired skill is by design, not a broken pairing. (Paired examples for contrast: `researcher` agent ↔ `research` skill; `code-simplifier` agent ↔ the `develop` skill's `simplification` fragment.)

**Adversarial-stance opt-in.** The skeptical-by-default voice is a named, discoverable pattern: agents opt in with `x-aegis.stance: skeptical` in frontmatter, governed by `rules/skeptical-stance.md` (claims are wrong until evidence proves them right; no rubber-stamping). `code-reviewer`, `code-quality-reviewer`, and `doc-verifier` carry it; all other agents keep their neutral voice. The `STANCE` validator cross-checks that the field and the body agree. The former `strict-reviewer` agent was folded into `code-reviewer --strict` (the adversarial lock-in / irreversible-decision lens, `min_confidence: 0`); `code-reviewer --strict` is its successor. See `rules/skeptical-stance.md` for the full pattern.

**`x-claude.primitiveHint` (Claude-only authoring hint).** An agent that should open with the primitive-disambiguation blockquote on Claude carries `primitiveHint: agent` under its `x-claude:` block. The projector reads it to RE-INJECT `> **Invoke via \`Agent({subagent_type: "aegis:<name>"})\`.** This is an agent, not a skill.` at the top of the generated Claude body (`adapters/claude/agents/<name>.md`). Canonical bodies stay host-neutral — they do NOT carry the blockquote (any *other* blockquote, e.g. the Agent-only note, is unaffected). `primitiveHint` is **consumed-not-emitted**: it never appears in generated Claude frontmatter, and OpenCode/Codex bodies get no Invoke-via blockquote. (Same field/semantics as skills — see `skills/AGENTS.md`.)

**Model is a capability-intent tier, and it is a default rather than a ceiling.** Never put `model:` in agent frontmatter — per-agent model lives solely in `manifest/permissions.json` (the projector hard-fails on `x-claude.model`). Declare an *intent tier*: `deep` (heavy reasoning — planning, strict review, architecture), `balanced` (default implementation work), `fast` (cheap, mechanical work), or `inherit` (run on whatever the caller is running). `inherit` is declared explicitly, not by omitting the key — an agent that means "defer to the caller" should say so rather than look like one whose tier was forgotten. `manifest/models.json` resolves the tier to a host-native ID; on Claude that is `claude-opus-4-8` / `claude-sonnet-4-6` / `claude-haiku-4-5`. The tier says what kind of thinking the work needs, so the declaration still means something on a host that has never heard of Opus.

A **dispatch-time `model` override wins over the projected frontmatter**, so "I need Opus for this one" is not a reason to skip an Aegis agent — pass the model at dispatch: `Agent({subagent_type: "aegis:code-explorer", model: "opus", prompt: "…"})`. Claude Code's precedence is `CLAUDE_CODE_SUBAGENT_MODEL` env var > per-invocation `model` parameter > frontmatter `model:` > the main conversation's model (`references/claude-code-docs/docs/sub-agents.md:301-306`). This is Claude-specific: Codex has no per-agent model-override surface, and Cursor/Zed read rules rather than agent frontmatter. See `docs/agent-permissions.md` for the full table and caveats.

**`/agents` wizard removal is UX-only (v2.1.198).** Claude Code dropped the interactive `/agents` wizard, but the subagent contract Aegis depends on — `agents/<name>.md` → generated `adapters/claude/agents/<name>.md`, lean 4-field + `x-claude:` frontmatter, plugin `agents/` tree scanning — is unchanged, and Aegis never authored through the wizard. Nothing here breaks.

### `commands/`

Purpose: slash-command workflow entry-points that don't map to a single skill. Hard cap **~15 commands**. Skills already auto-expose as `/<skill-name>` on supporting hosts; only add a command when composing multiple skills. Frontmatter is the lean 4 fields (`name`, `description`, `visibility`, `platforms`). Use `x-claude.argument-hint` for Claude argument hints. **Never** add `AGENTS.md` or `CLAUDE.md` here. CLI-coupled commands depending on `bunx anvil` belong on the deferred list, not in this folder.

### `rules/`

Purpose: universal always-loaded iron-law guidance (folder-level guidance lives in `rules/AGENTS.md`). One note worth surfacing here: **`rules/user-choice-example.md` is a non-invocable demo** — an E2E payload-shape fixture showing the conformant Q1 (location) + Q2 (format) `AskUserQuestion` shapes, NOT a shipping rule/skill. It documents the pattern that `rules/user-choice-discipline.md` governs; do not route work to it or treat it as behaviour-governing.

## Security & Configuration Tips

Every PR must pass `node scripts/validate-structure.mjs` **plus** the five security scans:

```bash
node scripts/validate-structure.mjs        # structure + warn-only hardening rules (<30s)
bash scripts/secret-scan.sh                 # likely secrets / API keys / private keys
bash scripts/base64-scan.sh                 # suspicious long base64 payloads
bash scripts/prompt-injection-scan.sh       # prompt-injection phrases in canonical prose
bash scripts/unicode-safety-scan.sh         # zero-width/bidi (Trojan Source) Unicode
bash scripts/personal-paths-scan.sh         # hardcoded /home/<you> personal paths in shipped content
```

Each scan is stdlib bash (no deps) and exits non-zero on a hit. They are heuristic, not a substitute for real secret management — see `docs/security.md`. The validator catalog (every rule, its warn/error stage, remediation) lives in `docs/validators.md`. Newer validator rules land **warn-only** and graduate to hard-fail a release later.

**MCP connectors: ship none by default.** Aegis carries no `mcpServers` — adding one requires clearing the two-prong test (universal AND MCP genuinely beats a wrapped CLI/API). See `docs/mcp-policy.md` for the test, the per-session token rationale, and the 64-character tool-name gateway constraint.
