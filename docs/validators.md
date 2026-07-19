# Validators

Aegis ships one structural gate and two standalone editorial gates. This page
catalogs every rule: what it checks, whether it warns or hard-fails, and how to
fix the thing it flags.

All maintainer scripts are Node 20+ stdlib only — no npm dependencies, no Bun.

## The split architecture

`scripts/validate-structure.mjs` is a thin entry point. It does nothing but
`import "./validate/index.mjs"`. The real work lives in the orchestrator and a
set of per-rule modules:

- **`scripts/validate/index.mjs`** — the orchestrator. It builds the shared
  context once, runs each rule module in a fixed order, concatenates every
  rule's errors and warnings, prints warnings then errors, and calls
  `process.exit(1)` if any errors were collected.
- **`scripts/validate/_context.mjs`** — the shared context, built once per run.
  It performs a single filesystem walk and exposes a read-through cache so no
  rule re-walks the tree or re-reads a file. It also provides helpers: `rel(p)`
  (path relative to the repo root), `read(p)` (memoized file read), `fmSplit`
  (frontmatter splitter), `fmTopKeys` (top-level frontmatter keys), and
  `stripFences` (drop fenced code blocks before prose matching).
- **`scripts/validate/<rule>.mjs`** — one module per check, each exporting an
  `id` string and a `run(ctx)` function returning `{ errors, warnings }`.

The single walk plus the read cache exist for one reason: the **30-second
ceiling**. The orchestrator times the whole run and, if it exceeds 30000 ms,
pushes a hard error of its own. Anvil's test suite reached 20 minutes; that is
the failure mode this design avoids. If validation creeps past five seconds,
audit for tree re-walks, re-reads, or regex-heavy passes that a single walk
could cover.

Errors fail the build (exit 1). Warnings print but never fail it.

## Warn-then-error rollout

A new validator rule lands **warn-only**. It surfaces a
warning, the build stays green, and canonical content gets one release to clear
before the rule graduates to a hard-fail the release after. This applies to the
rules below (`TOOL_NAME_LEAK`, `AGENT_NAME_COLLISION`, `SKILL_DESC_LONG`,
`BUCKET_README_MISSING`, `SKILL_LOCK_MISSING`) and to the standalone
`validate-prose.mjs` gate. Older, more established rules already hard-fail.
(The body-length check originally shipped as `SKILL_BODY_LONG`; it was later
renamed and moved to the dedicated `SKILL_SIZE` rule — see *Body-size rules*
below.)

Note: `SKILL_OVER_CODEX_CAP` was removed once found to be bogus. The per-body
8 KB cap was an unsourced Aegis guardrail targeting the wrong unit. The real
Codex budget is ~8,000 characters on the aggregated skills *list*
(names+descriptions), not per-body — the full skill body is read with no
truncation once selected. See `.aegis/research/codex-modernization.research.md §1`.

## Pre-existing rules

These are older, established rules. Unless noted, they push to `errors` (hard-fail).
They run in the order listed, matching the original monolith's section sequence.

| Rule id | What it checks | Stage | Remediation |
|---|---|---|---|
| `ROOT_FILES` | The required root files exist: `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, `CLAUDE.md`, `CHANGELOG.md`, `package.json`. | error | Add the missing root file. |
| `SPARSE_GUIDANCE` | Every `AGENTS.md`/`CLAUDE.md` sits in an approved guidance folder, at depth ≤ 1; each approved folder that exists has an `AGENTS.md`; each `CLAUDE.md` is the exact one-line `@./AGENTS.md` stub. | error | Move guidance into an approved folder, remove nested copies, or make the `CLAUDE.md` a one-line `@./AGENTS.md` import. |
| `FRONTMATTER` | Every canonical surface (`skills/**/SKILL.md`, `agents/*.md`, `commands/*.md`, `rules/*.md`) opens with a closed frontmatter block carrying the lean 5 keys: `kind`, `name`, `description`, `visibility`, `platforms`. | error | Add or close the frontmatter and include the missing key. |
| `MANIFEST` | `manifest/aegis.manifest.json` and `manifest/schemas/aegis-surface.schema.json` exist and parse as JSON. | error | Fix the JSON or restore the missing file. |
| `STATUSLINE` | Each `statuslines/<preset>/statusline.json` and `statuslines/_shared/themes/*.json` matches its contract: theme name matches filename and has a non-empty `colors` map; preset has `kind: statusline`, a matching `name`, required keys, a non-empty `platforms` array, a known `theme`, valid segment IDs, and a non-negative integer `refreshIntervalSeconds`. | error | Correct the descriptor or theme to match the contract; only the 16 known segment IDs are allowed. |
| `TEMPLATES` | Each template manifest (`*.template.json`) parses and carries `kind: template`, `name`, `family` (one of `html`/`markdown`/`json`), `version`, `description`, and a `slots` array. Each template body file should have a sibling manifest. | mixed: malformed manifest is an **error**; a body file with no sibling manifest is a **warning**. | Fix the manifest, or add the missing `<name>.template.json` sibling. |
| `TEMPLATE_INDEX` | Integrity of `manifest/template-index.json` against on-disk bodies + sibling manifests: (1) every `formats.{html,markdown,json}` path exists; (2) each kind's `default` is a key in its `formats`; (3) orphan bodies not registered in the index (warn — variant/unported); (4) **full-path slot↔body correspondence** — every declared slot key appears in the body (an array slot `<base>[]` is satisfied by a `<base>` or `<base>.<field>` marker; a scalar/dotted slot must match exactly), every body marker matches a declared key by full path (a bogus sub-path of a scalar slot is an error), and every HTML/MD `shape` array `<base>[]` is wired into the body (a `<base>` marker exists or `<base>` is nested in another shape value). JSON `shape` is documentary (flattened-field convention) and exempt from the shape-presence rule. The shared SLOT regex + body skip-list live in `scripts/validate/_context.mjs`, consumed by both this rule and the render harness. | mixed: path/default/slot↔body problems are **errors**; an unregistered body is a **warning**. | Align the manifest `slots`/`shape` with the body markers per the convention in `templates/AGENTS.md`, or fix the index path/`default`. |
| `CODEX` | Codex projection under `.codex/plugins/aegis/skills/` — each projected `SKILL.md` exists, has closed frontmatter with `name`/`description`, has a non-empty body, resolves its `abilities/` and `references/` links, carries no stale `commands/<name>.md` references, and agent-derived skills carry the discovery marker header. Plus `.codex/INSTALL.md` rule-load phrase and manifest `hostStatus.codex` self-consistency. Skipped entirely if `.codex/` is absent. | mixed: most checks **error**; unresolved `${TEMPLATE:}` placeholders and a `<owner>` homepage placeholder are **warnings**. | Re-run projection; resolve dangling links and template placeholders. |
| `PLUGIN_MANIFESTS` | `.codex/plugins/aegis/.codex-plugin/plugin.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, and `.agents/plugins/marketplace.json` versions all match `package.json`. Also validates the per-host marketplace source shapes: `.claude-plugin/marketplace.json` (Claude) MUST use a relative-path **string** `source` that does not escape the root; `.agents/plugins/marketplace.json` (Codex) MUST use the **object** `{source, path}` form. | error | Bump the lagging manifest version to match `package.json`; run `node scripts/project.mjs` to regenerate. |
| `CODEX_AGENTS` | `.codex-plugin/AGENTS.md` carries an H2 heading (`## <name>`) for every `rules/*.md` file. | error | Add the missing `## <rule-name>` section. |
| `HOOK_INTENT` | Every `hooks/*.json` intent satisfies the canonical contract: schema shape (kind/name/description/visibility/platforms), event→dispatch support table, `.md` pairing when required, command-file existence, compaction pre⇔post symmetry, plugin.json drift (D6 — regenerates the expected Claude hooks block in-memory and compares to committed `.claude-plugin/plugin.json`), x-claude binding completeness when `platforms ⊇ claude`, x-opencode binding completeness when `platforms ⊇ opencode`, x-codex binding completeness + event enum validation when `platforms ⊇ codex`, and per-host adapter gap-coverage (every shipped intent must have a hook-matrix row in every `adapters/<host>/projection.md`). | error (all checks hard-fail) | Fix the intent JSON, add the missing .md sibling, re-run `node scripts/project.mjs` to regenerate the Claude hooks block, or add the missing hook-matrix row in the failing adapter's `projection.md`. |
| `PERMISSIONS` | Permission-drift check (wraps `scripts/lib/validate-permissions.mjs`): the per-host projected agent permissions match `manifest/permissions.json`. | error (per the library) | Re-run projection so projected `tools:` allowlists match the manifest. |
| `CAPABILITIES` | The new manifest set (`capabilities.json`, `models.json`, `permissions.json`, and their schemas) exists and parses; each capability has a unique `id`, a `hosts` object covering all five host keys with a valid `status`, and non-empty `evidence` for `supported`/`partial` entries. All five host keys (`claude, opencode, codex, cursor, zed`) stay required even while Cursor + Zed are deferred (~v0.5.0): their cells are pinned to `gap`/`n/a` (which need no evidence), so the deferral is status-only with no schema/validator edits. | mixed: structural problems **error**; a bare evidence path that does not resolve is a **warning**. | Add the missing manifest, fix the JSON, or supply evidence for the host entry. |
| `CLAUDE_DRIFT` | Structural drift between canonical and the committed Claude tree under `adapters/claude/`: skill and agent parity per scope; every `plugin.json` agents path resolves; every `plugin.json` skills entry is a **bucket-root directory** containing at least one `<name>/SKILL.md` child one level deep (a per-skill path is rejected — Claude would register nothing), and every on-disk scope bucket with skills is listed; no unresolved `${TEMPLATE:}` tokens in the generated tree; generated frontmatter carries only allowed keys. Detects structural drift only, **not** body-content drift. | error | Re-run `node scripts/project.mjs` so the committed tree matches canonical. |
| `CAPABILITY_DOCS_SYNC` | `docs/harnesses.md` and `docs/capability-matrix.md` are in sync with `manifest/capabilities.json` (shells out to `sync-capabilities.mjs --check`). | error | Run `node scripts/sync-capabilities.mjs` to regenerate the docs. |

## Earlier hardening-pass rules (warn-only)

These rules all push to `warnings` only for one release and graduate to hard-fail
the release after.

Note: `SKILL_OVER_CODEX_CAP` (the per-body 8 KB cap rule, `skill-codex-cap.mjs`)
was removed once found to be bogus — see the *Warn-then-error rollout* note above.

### `TOOL_NAME_LEAK` — Claude-specific tool names in prose

Module: `scripts/validate/tool-name-leak.mjs`.

Lints skill bodies (`skills/**/SKILL.md`, `skills/**/abilities/*.md`) and
`agents/*.md` for host-specific tool names: `Read`, `Edit`, `Bash`, `Grep`,
`Glob`, `Task`, `TodoWrite`, `WebFetch`, `WebSearch`. Fenced code blocks are
stripped first — linting inside code fences produces too many false positives.
Because several of these names are common English words, the rule only flags
**high-confidence** references: backtick-wrapped (`` `Read` ``), `<Tool> tool`,
`<Tool>()`, or `use the <Tool>`. It emits one aggregated warning per file
listing the leaked names, not one per occurrence, and runs in under five
seconds on the full tree.

**Remediation:** prefer host-neutral phrasing — "read the file", "run the
command", "search the code", "dispatch a subagent", and so on.

### `AGENT_NAME_COLLISION` — cross-surface name collisions

Module: `scripts/validate/agent-name-collision.mjs` (uses
`scripts/lib/collision-names.mjs`).

Surfaces register under one flat name namespace on most hosts, so a skill, an
agent, and a command sharing a name collide. This rule warns on any name claimed
by more than one surface across `skills/`, `agents/`, and `commands/`, or
duplicated within one kind. It does **not** warn about the missing
`<plugin>-<agent>` prefix mentioned in the plan: canonical agent names carry no
`aegis-` prefix by design — the prefix is added at projection time — so a
per-agent prefix warning would fire on every agent and be pure noise.

**Remediation:** rename one of the colliding surfaces.

### `SKILL_SIZE` — canonical SKILL.md body size cap (warn-only)

Module: `scripts/validate/skill-size.mjs`.

For each canonical `skills/<scope>/<name>/SKILL.md`, **`SKILL_SIZE`** warns when
the body (after the frontmatter) exceeds **100 lines**.

**Single owner, no double-finding.** This rule is the
**sole** owner of the >100-line body finding. The body-length check that
previously lived in `skill-body-long.mjs` (`SKILL_BODY_LONG`) was moved here so
that a skill over 100 lines produces **exactly one** size warning, not two.
`SKILL_BODY_LONG` is retired; `skill-body-long.mjs` now emits only
`SKILL_DESC_LONG` (see below).

**Stage: warn-only this release, graduating to hard-fail.** 29 canonical skills
exceeded 100 lines when this rule landed; hard-failing immediately would break the
build. Progressive disclosure restructures them a few at a
time into a lean `SKILL.md` plus `references/`/`abilities/` overflow — an early
pass split the four largest (`sdd-workflow`, `two-stage-review`,
`verification`, `using-git-worktrees`); the remaining ~25 are the documented
warn-only backlog. The cap graduates to **hard-fail** once that backlog is
cleared, following the usual warn→error graduation convention.

**Remediation:** move deep reference detail into `references/<x>.md` and
on-demand fragments into `abilities/<x>.md` (both stay **unregistered** per Iron
Law 4 — only the parent `SKILL.md` is registered). The lean `SKILL.md` keeps the
nav header, when-to-use, decision forks, and pointers to the overflow.

### `SKILL_DESC_LONG` — description length cap

Module: `scripts/validate/skill-body-long.mjs`.

For each canonical `skills/<scope>/<name>/SKILL.md`, **`SKILL_DESC_LONG`** warns
when the frontmatter `description:` value exceeds **1024 characters**. (The
body-length cap moved out of this module to `skill-size.mjs` — see
`SKILL_SIZE` above.)

**Remediation:** tighten an over-long description to a single trigger sentence.

### `BUCKET_README_MISSING` — bucket / family README coverage

Module: `scripts/validate/bucket-readme.mjs`.

Every skill bucket (`skills/core`, `skills/languages`, `skills/workflows`) and
every template family (`templates/html`, `templates/markdown`, `templates/json`)
that exists must contain a `README.md` that mentions every shipping child. Skill
children are subdirectories holding a `SKILL.md`; template-family children are
the base stems of shipping template files (the `.template.json` config companion
is excluded). A child is "mentioned" if its name appears anywhere in the README.
The rule warns when the README is missing or omits a child. The manifest does
not enumerate per-bucket child names, so the child set is derived from the
directory.

**Remediation:** add the missing `README.md`, or list the omitted child(ren) in
the existing one.

### `SKILL_LOCK_MISSING` — external-skill lockfile

Module: `scripts/validate/lockfile.mjs`.

`skills-lock.json` at the repo root records skills installed from **outside** the
package, with the lean schema `{ "version": <number>, "skills": <object> }`.
The semantics are external-source-aware: in-tree canonical skills are the source
and need no lock entry. The rule warns when `skills-lock.json` is missing or
malformed, and when a canonical skill declares a non-`anvil:` `source:` (treated
as external) without a matching key in the lockfile's `skills` map. No external
skills exist today, so the per-skill check effectively no-ops; it is in place for
the future.

**Remediation:** seed `skills-lock.json` with `{ "version": 1, "skills": {} }`,
or add a lock entry for any externally-sourced skill.

## Named-artifact rule (warn-only)

### `NAMED_ARTIFACT_TEMPLATE` — named artifact must reference a template

Module: `scripts/validate/named-artifact-template.mjs`.

Enforces the named-artifact rule from `rules/templates.md`: any skill (`SKILL.md`)
or agent (`agents/*.md`) that emits a **named artifact** MUST reference a template
kind via a `${TEMPLATE:<kind>}` reference **or** carry a `// REASON:` note
justifying why no template applies.

The check is **producer-side**: it flags a body that carries a named-artifact
emission signal (an `## Output` / `## Deliverables` / `## Structured Output`
section heading) but contains neither a `${TEMPLATE:` reference nor a `// REASON:`
note. It is conservative — disciplines whose output is inline findings prose with
no such heading are not flagged.

**Stage:** **warn-only.** It surfaces the remaining unwired-producer
backlog (producers get wired, or given a `// REASON:`, in later releases). It
graduates to **hard-fail** in a later release, consistent with the usual
warn → error convention.

**Graduation precondition (do NOT skip):** the current heuristic keys on the
`## Output` / `## Deliverables` / `## Structured Output` heading alone, which
over-flags producers whose "output" is an *ephemeral completion report* (e.g.
`mcp-builder`, `ultra-worker`, `skill-selection`, `verification`) rather than a
durable written artifact — ~25 warn-only hits today, several of them false
positives against the rule's own narrow definition. Before this rule graduates
to hard-fail, the heuristic MUST be narrowed (require a write/handoff verb, a
path/filename, or an explicit artifact-kind noun near the heading) **and/or**
every remaining flagged producer must be triaged — wired to a kind or given a
`// REASON:`. Graduating the current heuristic as-is would break those producers.

**designOnly interaction:** this is producer-side, so a kind flagged
`designOnly: true` (which by definition has no producer) never appears here. The
expected-orphan semantics for design-only kinds are recorded in
`scripts/validate/template-index.mjs`; a future kind-coverage check must keep
designOnly kinds exempt from any "kind has no producer" warning.

**Remediation:** wire the producer to its kind with a `${TEMPLATE:<kind>}`
reference (see `rules/templates.md`), or add a `// REASON:` note if the artifact
genuinely has no template kind.

## Trigger-phrase, doc-drift, and stance rules

Three rules landed together: a warn-only trigger-phrase lint, a doc-drift
validator (count + dead-link, both hard-fail), and a warn-only stance
cross-check.

### `TRIGGER_PHRASE` — description must carry a "Use when…" clause (warn-only)

Module: `scripts/validate/trigger-phrase.mjs`.

For every skill `SKILL.md` (`skills/**`) and every `agents/*.md` (excluding
`AGENTS.md`/`CLAUDE.md`), the rule parses the frontmatter `description:` and warns
when it lacks a case-insensitive **"use when"** trigger clause. A conformant
description opens its selection guidance with a `Use when …` anchor (e.g.
*"Use when reviewing diffs for quality…"*), which materially improves skill/agent
selection reliability across the surface set.

**Stage:** **warn-only**, mirroring the usual warn → error
cadence. It **graduates to hard-fail** the following release. The lint is purely diagnostic
at first — no canonical descriptions are rewritten yet; the backlog it
surfaces (most agents lack the clause today) is cleared before graduation.

**Remediation:** prefix the `description` selection guidance with a `Use when …`
trigger clause.

### `DOC_DRIFT` — stale counts + dead links

Module: `scripts/validate/doc-drift.mjs`. This rule folds the standalone
`validate-counts.mjs` drift contract into the single shared walk and adds an
internal/`references/` dead-link check. It shells out to `inventory.mjs` **once**
for the count truth (counts cannot be derived from `ctx.files`) and otherwise
rides `ctx.read`/`ctx.files` — no second filesystem walk.

- **Count drift (ERROR).** Numeric `<n> <surface>` claims — "79 skills",
  "17 agents", "13 rules" — in `README.md`, the root `AGENTS.md`,
  `docs/architecture.md`, **and** `.claude-plugin/plugin.json` must match the live
  inventory. Tilde-prefixed approximate caps ("~15 commands") are design caps, not
  counts, and are ignored. Drift is **hard-fail**, matching the standalone gate's
  exit-1 contract.
- **Dead links (ERROR).** Repo-internal and `references/`-relative markdown links
  in **canonical-prose** folders (`README.md`, root `AGENTS.md`, `CONTRIBUTING.md`,
  `CHANGELOG.md`, and `docs/`, `rules/`, `skills/`, `agents/`, `commands/`,
  `hooks/`, `templates/`, `statuslines/`, `.aegis/`) are resolved relative to the
  linking file. Repo-internal targets are checked against the in-memory `ctx.files`
  set (no `fs` storm); a link to a folder is accepted if any file lives under it.
  `references/`-relative targets are checked with an explicit existence test
  against the repo root (honoring the read-only law — existence only, contents
  never read); because `references/` is excluded from the walk and may be
  unmaterialized in a git worktree, a `references/` link is treated as
  **unverifiable and skipped** when the `references/` directory itself is absent,
  and flagged broken only when the directory is present but the target is missing.
  External (`http:`, `mailto:`, protocol-relative) and pure-anchor (`#…`) links are
  skipped. Broken internal/`references/` links are **hard-fail**. Generated trees
  (`adapters/<host>` generated dirs, `.codex/`, `.opencode/`) are out of scope to
  stay inside the 30s ceiling.
- **Oversize skills — NOT owned here.** The audit's "oversize skills" item is
  covered by **`SKILL_SIZE`** (`scripts/validate/skill-size.mjs`), the single
  owner of the >100-line body warning (later renamed from the former
  `SKILL_BODY_LONG`). `DOC_DRIFT` deliberately does **not** re-flag oversize, to
  avoid emitting two warnings for the same skill.

`validate-counts.mjs` is **retained** as a thin standalone gate (separately
runnable in CI/by maintainers); `DOC_DRIFT` is the in-pass owner of the same
count-drift contract, and both read the same `inventory.mjs` truth so they cannot
disagree.

**Remediation:** update the doc number to match `node scripts/inventory.mjs`, or
fix the broken link target.

### `STANCE` — skeptical-stance field ↔ body cross-check (warn-only)

Module: `scripts/validate/stance.mjs`. Enforces the opt-in pattern in
`rules/skeptical-stance.md`: an agent whose body carries the adversarial /
skeptical voice (framing markers like "skeptical", "wrong until", "rubber-stamp",
"guilty until", "GSD") must declare `x-aegis.stance: skeptical` in
frontmatter, and an agent that declares the field must open its body with the
skeptical framing. Drift in either direction warns. `x-aegis.` is an accepted
`x-<adapter>`-style namespace per `manifest/schemas/aegis-surface.schema.json`.

**Stage:** **warn-only** (new-rule cadence).

**Remediation:** add `x-aegis.stance: skeptical` to the frontmatter, or align the
body's opening framing with the declared stance.

## New v0.1.0 rules (warn-only)

### `AGENT_PLUGIN_DROP` — plugin-subagent silent-drop trap (warn-only)

Module: `scripts/validate/agent-plugin-drop.mjs`. Walks canonical `agents/*.md`,
parses the top-level `x-claude:` block, and warns once per offending field when
an agent declares `x-claude.hooks`, `x-claude.mcpServers`, or
`x-claude.permissionMode`. Claude **silently drops** those three fields from a
subagent's frontmatter when the agent is loaded from a plugin (cc-docs
`sub-agents.md:233-234`). Aegis ships its agents as a plugin, so projecting any
of them into `adapters/claude/agents/*.md` produces a no-op that looks correct —
the field is present but never honored. `x-claude.memory`, `skills`, `effort`,
`isolation`, and `model` **are** honored for plugin subagents and are
deliberately NOT flagged.

**Stage:** **warn-only** in v0.1.0 (new-rule cadence).

**Remediation:** remove the offending `x-claude.<field>` from the agent, or move
the intended behavior to a host-honored mechanism (e.g. a portable hook intent
under `hooks/` for `hooks`, project-level MCP config for `mcpServers`).

## New v0.1.2 rules

### `DESCRIPTION_SHAPE` — description must read as WHEN, not WHAT (warn-only)

Module: `scripts/validate/description-shape.mjs`. For every skill `SKILL.md`
(`skills/**`) and every `agents/*.md` (excluding `AGENTS.md`/`CLAUDE.md`), the
rule parses the frontmatter `description:` and warns when it carries a
mechanism marker: an arrow (`→`/`->`) or a conjugated process verb (`runs `,
`emits `, `orchestrates `, `dispatches `, trailing space required so the
`dispatch` noun never matches the conjugated verb form). A conformant
description describes WHEN to invoke the surface, not WHAT it internally does
once invoked.

**Scope is deliberately narrow.** The "Use when X — `<gloss>`" em-dash shape is
house style across ~40 descriptions in this catalog; a literal em-dash marker
would fire catalog-wide (false-positive explosion) and is explicitly NOT
implemented. Arrow + the four conjugated verbs are the mechanical proxy for the
pipeline/step-enumeration smell the rule targets.

**Stage:** **warn-only** in v0.1.2 (new-rule cadence). It **graduates to
hard-fail in v0.1.3**, preconditioned on (a) canonical staying warning-free for
one full release, and (b) a situational-arrow guard being added first so a
future legitimate trigger clause containing an arrow (e.g. "Use when migrating
React -> Vue") is not falsely flagged.

**Remediation:** rewrite the `description` as a pure "Use when …" trigger
clause; move mechanism/output detail out of the description and into the skill
or agent body.

**Necessary, not sufficient.** A clean `DESCRIPTION_SHAPE` pass does NOT prove
every description is a pure WHEN-trigger — the rule is a narrow mechanical
proxy limited to an arrow plus four conjugated verbs (`runs `, `emits `,
`orchestrates `, `dispatches `). Other WHAT-style verbs — `produces`,
`generates`, `scores`, `assembles`, and similar — pass the rule clean even
though they describe mechanism, not trigger condition. Treat a zero-warning
run as "no known mechanical smell detected," not as "every description is
trigger-pure."

**Scope.** The rule lints `skills/**/SKILL.md` and `agents/*.md` only.
`commands/*.md` descriptions are explicitly out of scope — intentionally, for
now; commands are a small, capped set (~15) reviewed by hand, and extending
the rule there is a candidate for a future release, not a gap being silently
carried.

## New v0.1.4 rules

### `SHIPPED_REF` — pre-launch ticket / version residue guard (warn-only)

Module: `scripts/validate/shipped-ref.mjs`. Follows a pre-launch residue sweep
that scrubbed every internal ticket id and stale internal version stamp out of
the shipped tree; this rule is the guard that keeps it clean. Reuses the
shared ctx walk (no second walk). Two independent checks:

1. **`AG-[0-9]{4}`** (uppercase ticket ids) — flagged in **all** scanned
   files, any extension. Case-sensitive by design: the lowercase
   `.aegis/specs/features/ag-NNNN-<slug>/` path-citation form never matches.
2. **Pre-launch internal version stamp** `v0.(0|2|3).N` — flagged in **`.md`
   files only**. The current public series (`v0.1.x`) and host-version refs
   (e.g. `v2.1.105`) never match the pattern. Non-`.md` code-comment stamps
   (`scripts/**.mjs`, `statuslines/**.mjs`, `*.template.json`) are
   deliberately out of scope for now — see the graduation note below.

**Exclusions:** dot-dirs and `references/` are already excluded by the shared
ctx walk. This rule additionally exempts `CHANGELOG.md` (public history
starts at v0.1.0) and the whole `scripts/tests/` directory, which legitimately
plants example `AG-NNNN` / `v0.x.y` strings as test fixtures (including this
rule's own unit test, `scripts/tests/shipped-ref.test.mjs`). The allowlist is
intentionally empty: after the residue sweep, zero legitimate refs remain in
the scanned surface, so no allowlist entries are required — add one only with
written justification.

**Stage:** **warn-only** in v0.1.4 (new-rule cadence). It **graduates to
hard-fail in the 0.2.0 release** (written without the `v0.` prefix in this
sentence on purpose — that exact prefix-plus-digit shape is what this very
rule's version-stamp check flags, and this line lives in a scanned `.md`
file), preconditioned on canonical staying warning-free from v0.1.4 through
that release.

**Remediation:** remove the ticket id, or rewrite the version-specific phrase
version-neutrally (e.g. "an earlier release", "a prior hardening pass").

**Necessary, not sufficient.** A clean `SHIPPED_REF` pass does NOT prove the
shipped tree is free of internal-planning residue — it is a narrow mechanical
proxy for exactly two patterns (an uppercase ticket-id shape and a pre-launch
version-stamp shape). Other residue forms — internal codenames, unscrubbed
worktree/branch names in prose, private-repo file paths outside the
`ag-NNNN`-lowercase citation form — pass the rule clean even though they may
still leak internal planning context.

## Standalone gates

These two scripts are **not** wired into `validate-structure.mjs`. Run them
directly.

### `validate-prose.mjs` — LLM-cliché denylist (warn-only)

Module: `scripts/validate-prose.mjs`. Run: `node scripts/validate-prose.mjs`.

Scans canonical markdown prose (`skills/**/*.md`, `agents/*.md`,
`commands/*.md`, `rules/*.md`, `docs/*.md`) for a conservative ~15-term
denylist of LLM-cliché filler. Matching is case-insensitive and
whole-word/phrase; fenced code blocks are exempt. The authoritative term list
lives in the script's `DENYLIST` const; the rationale and the warn-then-error
rollout are documented in [`style-guide.md`](style-guide.md) — keep the two in
sync.

Default behaviour is **warn-only**: it prints every hit (`file:line: term`) and
exits 0. The reserved `--strict` flag exits non-zero on any hit; it is held for
a future graduation and not used in CI yet.

**Remediation:** rewrite the flagged phrase plainly. See
[`style-guide.md`](style-guide.md) for per-term guidance.

### `validate-counts.mjs` — surface-count drift (hard-fail)

Module: `scripts/validate-counts.mjs`. Run: `node scripts/validate-counts.mjs`.

Verifies numeric surface-count claims in `README.md`, the root `AGENTS.md`, and
`docs/architecture.md` against the live inventory from `scripts/inventory.mjs`
(it shells out rather than re-walking). A claim is a number next to a surface
keyword — "79 skills", "18 agents", "12 rules". Tilde-prefixed approximate caps
("~15 commands") are design caps, not counts, and are ignored. This gate
**hard-fails (exit 1)** on any drift.

**Remediation:** update the doc number to match `node scripts/inventory.mjs`.

## Adding a new rule

1. Create `scripts/validate/<rule>.mjs` exporting an `id` string and a
   `run(ctx)` function that returns `{ errors, warnings }`. Pull what you need
   off `ctx` (use `ctx.read`, `ctx.files`, `ctx.rel`, `ctx.stripFences`, …) so
   you reuse the single walk and read cache.
2. In `scripts/validate/index.mjs`, add **one import** and **one entry** in the
   `RULES` array, placed where its output should appear in the run order.

That is the whole extension surface — one import, one array entry. Push to
`warnings` for a new rule's first release, then graduate it to `errors` the
following release per the warn-then-error rollout.
