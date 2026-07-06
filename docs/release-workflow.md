# Aegis Release Workflow Doctrine

> Authoritative pipeline for shipping an Aegis release. Agent-readable and
> human-readable. Adapted from a battle-tested predecessor pipeline; the
> Aegis-specific steps, gates, and lessons below are the source of truth.

This document is the **full pipeline** that drives a release from "branch cut"
to "main merged + tagged + local clean." The **Release Workflow** section in the
root `AGENTS.md` is the short pointer + post-merge checklist; this file is the
detailed procedure.

Aegis is **plugin-first**: there is no user CLI, no Bun, no TypeScript runtime,
no build step. Every verification is a Node-stdlib maintainer script or a stdlib
bash scan. Subagents operate inside an isolated git worktree with a constrained
toolset; the inline orchestrator is the **sole arbiter** of branch, network, and
`main`-affecting operations.

## Lessons carried forward (read before you ship)

These were learned the hard way on prior releases (this project and its
predecessor). They are non-negotiable.

1. **Concurrency cap: ONE subagent at a time by default; TWO is the absolute
   ceiling, never exceeded.** A wide fan-out (5 agents) once hit the provider
   usage limit mid-release. The general orchestration skill allows 5 parallel;
   **release work overrides that to 2 max.** Parallel mode still gives each
   ticket its own worktree, but no more than 2 agents ever run at once.
2. **Subagents NEVER push, branch, merge to main, or cherry-pick across
   branches.** The inline orchestrator owns all remote + `main` state. A
   role-boundary violation discards the work and re-dispatches.
3. **Planner writes its plan to disk and returns ONLY the path + a 5-line
   summary.** Echoing a plan body back through the orchestrator doubles it in
   context and burns tokens. The Coder reads the plan in full.
4. **Gate verification PRE-commit, never post-commit.** A failing post-commit
 gate forces a `git reset --hard HEAD~1` (which, post, the orchestrator
must run as `AEGIS_ALLOW_GIT_GUARD=1 git reset --hard HEAD~1`) and pollutes branch history.
   Pre-commit gating means a failure never lands.
5. **`gh pr merge --delete-branch` fails inside a Claude-managed worktree** —
   its local-cleanup half tries to switch the worktree to `main`, which the
   parent worktree already holds (`fatal: 'main' is already used by worktree`).
   Use the 3-step split: `gh pr merge --squash` → `git push origin --delete` →
   `ExitWorktree` for local teardown. See §G.4/§G.5.
6. **Strict review runs at RELEASE granularity, not per-ticket** — it catches
   cross-ticket drift (duplicated canonical content, an introduced build dep, a
   missing honest-gap) that per-ticket review misses.
7. **Tag every release with an annotated tag** (`git tag -a`, never lightweight),
   so the whole series carries a tagger/date/message. §G.6 makes tagging a
   required ship step. (The v0.0.x series + v0.1.0 are now contiguous and all
   annotated as of the 2026-06-14 backfill.)
8. **`${TEMPLATE}` / version stamps regenerate from `package.json`** via
   `node scripts/project.mjs`. Never hand-edit a generated file or a hook
   version stamp; bump the source and re-project.

## Model routing (hard)

| Role | Model | Agent |
|---|---|---|
| Orchestrator (inline main loop) — adjudicates, branches, pushes, merges, tags | **Opus High** | (inline) |
| Planner | **Opus High** | `anvil:subagent-executor` (write-to-disk) or `anvil:plan-writing` |
| Strict reviewer | **Opus High** | `anvil:strict-reviewer` (or `anvil:code-reviewer --strict`) |
| Architecture / design exploration (when a real design choice exists) | **Opus High** | `anvil:code-architect` |
| Coder / implementer / fixer | **Sonnet** | `anvil:subagent-executor` |
| Ship gate (G.1/G.2) · small mechanical tasks | **Sonnet** | `anvil:subagent-executor` |
| Release-prep / ticket-prep (when missing) — dispatched FIRST | **Opus High** | `anvil:subagent-executor` |

## Concurrency (hard)

**ONE subagent at a time by default. TWO is the absolute ceiling.** A planner for
ticket N+1 may overlap with the coder for ticket N **only** if the live agent
count stays ≤ 2 and their write paths are disjoint (planner writes
`.aegis/specs/features/ag-NNNN-*/`, coder writes canonical surfaces). Cancel the
most-recently-dispatched agent immediately if the cap slips.

**Prompt the owner serial-vs-parallel before the implementation phase** unless
told to run autonomously this cycle.

---

## TL;DR dispatch shapes

```
SEQUENTIAL mode (DEFAULT — ≤ 3 tickets / hotfixes / tightly-coupled work)
Orchestrator (Opus High, INLINE) — adjudicates, branches, pushes, merges, tags
  ├─ Step 1: Cut branch + worktree (INLINE bash, no subagent)
  ├─ Step 2: Per-ticket loop (ONE Coder at a time, single release worktree)
  │    ├─ D.1 Planner (Opus, writes plan to .aegis/specs/features/<id>/; returns path + 5-line summary)
  │    ├─ D.2 Plan check (INLINE — skim the 5-line summary; subagent only on escalation)
  │    └─ D.3 Coder + verify + commit (Sonnet — edits in the release worktree,
  │           runs the full static gate BEFORE commit, then ONE conventional
  │           commit DIRECTLY on release/v<X.Y.Z>. No push/branch/merge.)
  ├─ Step 3: Strict reviewer (Opus High — fixes in impl-plan shape)
  ├─ Step 4: Fixer per finding (Sonnet — edits + commits on release branch)
  └─ Step 5: Ship (Sonnet G.1/G.2; G.3/G.4/G.5/G.6 INLINE)
```

```
PARALLEL mode (opt-in; owner chooses at the implementation-phase prompt)
  ... same, except Step 2 runs per-wave (AT MOST 2 Coders, each in its own
  ticket worktree off release/v<X.Y.Z>); the orchestrator cherry-picks each
  ticket commit onto the release branch at the wave boundary, then prunes the
  ticket worktrees + branches before the next wave.
```

---

## A. Roles

- **Orchestrator (inline, Opus High).** Sole arbiter. Cuts the branch + worktree.
  Adjudicates planner/reviewer output. Pushes, opens + merges the PR, tags, and
  cleans up. The only actor that touches remote state or `main`.
- **Planner (Opus High subagent).** Reads the ticket + related source; writes an
  implementation plan to disk; returns ONLY the path + a 5-line summary.
- **Coder / Fixer (Sonnet subagent).** Writes code AND commits ONE conventional
  commit on the release branch (sequential) or its ticket branch (parallel).
  Runs the full static gate pre-commit. Does nothing else.
- **Strict reviewer (Opus High subagent).** Reviews the release diff vs `main`;
  emits findings as implementation-plan-shaped fixes (file + line + concrete
  change) so a Sonnet fixer applies them directly.
- **Ship gate (Sonnet subagent).** Mechanical pre-ship checklist (G.1) + the
  release commit (G.2).

Subagents return outputs; the orchestrator adjudicates and decides.

---

## B. Pre-flight (orchestrator, inline — halt + surface on any failure)

### B.1 Main branch state
```bash
git fetch origin
git checkout main
git pull --ff-only origin main
git status --porcelain        # MUST be empty
node -p "require('./package.json').version"   # note the current shipped version
```
If `package.json` does not match the last roadmap-shipped row, fix that first
(its own commit on `main`) before cutting the new release.

### B.2 Planning artefacts exist
Verify BEFORE the first planner dispatch:
- `.aegis/plans/v<X.Y.Z>-plan.md` — the release plan (goal, locked decisions,
  phased checkbox tasks, Definition of Done). This IS the ticket ledger.
- `.aegis/plans/_roadmap.md` — carries the release row.
- `.aegis/audits/<dated>-*.md` and/or `.aegis/research/*.research.md` — the
  audit/research that motivated the release (where applicable).

If the release plan is missing, halt — plan-first is non-negotiable.

### B.3 Ticket completeness
Every ticket the release ships exists at `.aegis/tasks/AG-NNNN-<slug>.md` with a
header (`Category`, `Parent`, `Audit row`, `Effort`) and a Summary + Acceptance
section, AND appears as a checkbox task in the release plan. The planner receives
the ticket file + the plan task + a brief; a ticket missing its acceptance lines
forces the planner to invent them. Mint or complete missing tickets FIRST (Opus
release-prep subagent).

### B.4 Static-gate doctrine compliance
Aegis verification is **static and dependency-free** — Node-stdlib scripts + bash
scans, run inside the worktree. No Bun, no network, no live-host mutation, no
`npm install` of runtime deps. A ticket that would require any of those is out of
scope for the standard loop; escalate.

---

## C. Step 1 — Cut release branch + worktree (INLINE, never delegated)

```bash
git checkout main && git pull --ff-only origin main

VERSION_TARGET="X.Y.Z"                       # e.g. 0.1.0
RELEASE_BRANCH="release/v${VERSION_TARGET}"
WORKTREE_PATH=".worktrees/release-v${VERSION_TARGET}"   # .worktrees/ is gitignored

git worktree add -b "${RELEASE_BRANCH}" "${WORKTREE_PATH}" main
( cd "${WORKTREE_PATH}" && git rev-parse --abbrev-ref HEAD )   # expect release/v<X.Y.Z>
```

All subsequent ticket loops operate from inside `${WORKTREE_PATH}`. The naming
convention `.worktrees/release-v<X.Y.Z>` is **relied on by isolation checks** —
subagents grep it to confirm they are inside the release worktree. See the `using-git-worktrees`
skill for gitignore-safe selection. **Why inline:** a subagent that can run
`git worktree add` can mutate the parent branch graph — exactly the capability
the isolation rules forbid.

> A small release may run on a plain branch (no worktree) when no parallelism is
> wanted and the orchestrator is comfortable committing on the branch directly.
> The worktree is mandatory for parallel mode and recommended for any release
> that dispatches Coders.

---

## D. Step 2 — Per-ticket loop

Iterate the ticket order in the release plan. **Sequential** (default): ONE Coder
at a time in the release worktree, committing directly on `release/v<X.Y.Z>`.
**Parallel** (opt-in): at most 2 Coders per wave, each in its own ticket worktree
off the release branch; the orchestrator cherry-picks at the wave boundary.

### D.0 Concurrency (authoritative)
ONE subagent at a time by default; TWO is the absolute ceiling. Planner-N+1 may
overlap Coder-N only within the ≤ 2 cap and with disjoint write paths. In
parallel mode each Coder gets `.worktrees/v<X.Y.Z>-AG-NNNN` on `ticket/AG-NNNN`;
two coders never share a worktree or branch (HEAD-ref / index / status races).

### D.1 Planner dispatch (Opus High)
Trivial mechanical tickets (single-file edit, one obvious path) may skip formal
planning — the orchestrator briefs the Coder directly from the ticket. For
non-trivial tickets dispatch `anvil:subagent-executor` (write-to-disk). Brief:

```
Operate in .worktrees/release-v<X.Y.Z>. Read in full:
 - .aegis/tasks/AG-NNNN-<slug>.md (the ticket)
 - the release plan task for AG-NNNN
  - any directly-related canonical source / scripts

Write a tight implementation plan to
  .aegis/specs/features/ag-NNNN-<slug>/implementation-plan.md
Sections: References, Files to touch, Concrete change, Static gate
(the exact verify commands), Acceptance-criteria map, Out of scope,
Execution checklist, Risk surface. Aegis iron laws apply (no Bun/TS-runtime/
build deps; lean 5-field frontmatter + x-<adapter>; canonical→generated, no
duplication; honest gaps; references/ is read-only).

Return ONLY:
  PLAN: <plan_path>
  FILES: <comma-separated touch list>
  ACS: <count>
  DEVIATIONS: <one-line or "none">
  STATUS: <ready | blocked: <reason>>
Do NOT return the plan body. Do NOT commit.
```
Route a genuine design choice (2+ approaches, cross-cutting refactor, new
subsystem) to `anvil:code-architect` instead.

### D.2 Plan check — INLINE-MINIMAL
Skim the 5-line summary only; do NOT read the plan body back.
- `ready` + `none` → dispatch D.3.
- `ready` + a drift deviation (lines shifted, file renamed) → accept, note in the
  Coder brief. A scope-expansion or AC-reinterpretation deviation → read the plan
  inline and adjudicate.
- `blocked` → re-dispatch D.1 with the gap list (max 3 attempts), then escalate.
Escalate to `anvil:plan-verifier` only for genuinely ambiguous cases.

### D.3 Coder dispatch (Sonnet) — stages + commits on the release branch
**Input:** ticket + plan + the release worktree path. **Brief MUST include this
verbatim role boundary + the Aegis static gate:**

```
## Hard role boundary (Coder ONLY)
You write code AND commit ONE conventional commit on release/v<X.Y.Z>. Nothing else.
FORBIDDEN: git push/pull/fetch; git checkout/switch/branch/merge/rebase/
  cherry-pick/reset --hard/stash; --no-verify; writes outside this worktree;
  Bun / npm-install of runtime deps / network / any live-host mutation.
PERMITTED git: status/diff/log/show (read-only); `git add <explicit-paths>`
  (NEVER `git add -A`/`.`); ONE `git commit`.
Commit shape:
 <prefix>(<scope>): AG-NNNN <one-line summary>

  <2-3 line body — what + why; reference the plan>
A role-boundary violation discards the work; the orchestrator runs
`AEGIS_ALLOW_GIT_GUARD=1 git reset --hard HEAD~1` and re-dispatches. (The
`AEGIS_ALLOW_GIT_GUARD=1` prefix is required: the git guard denies a bare
`reset --hard` even from the inline orchestrator session — this back-out is an
operator-approved exception, so the override is the sanctioned path.)

## Static gate — run ALL before staging; if any fails, fix + re-run (max 2 cycles).
Commit only when green:
  node scripts/validate-structure.mjs            # structure + warn-only (<30s)
  node scripts/test-projection.mjs               # projection golden (6/6)
  node scripts/test-deny-hook.mjs                # deny-hook regression (bash+jq)
  bash scripts/secret-scan.sh
  bash scripts/base64-scan.sh
  bash scripts/prompt-injection-scan.sh
  bash scripts/unicode-safety-scan.sh
  bash scripts/personal-paths-scan.sh
  node scripts/project.mjs                       # if you touched canonical surfaces:
  git status --porcelain                         #   then re-project; only intended generated files may change
Stage explicit paths, verify with `git diff --cached --name-only`, then commit.
Report: VALIDATE: ok | PROJECTION: N/N | DENY: N/N | SCANS: 5/5 | COMMIT_SHA: <sha> | FILES: <list>
```
If you touched a canonical surface (`skills/`, `agents/`, `commands/`, `hooks/`,
`rules/`, `templates/`, `statuslines/`, `manifest/`), `node scripts/project.mjs`
MUST be run and its generated-file changes committed in the SAME commit — a
canonical edit without re-projection is a drift bug the strict reviewer will
catch. On failure to converge in 2 retries, escalate.

### D.4 Parallel-mode mechanics (opt-in only)
Per wave (≤ 2 tickets, disjoint file surfaces): orchestrator INLINE creates
`git worktree add -b ticket/AG-NNNN .worktrees/v<X.Y.Z>-AG-NNNN release/v<X.Y.Z>`;
dispatches ≤ 2 Coders (each `cd`s into its own worktree, verifies its branch,
commits there only — no push/merge/cherry-pick); then the orchestrator
cherry-picks each ticket commit onto `release/v<X.Y.Z>` in deterministic order
and prunes (`git worktree remove …` + `git branch -D ticket/AG-NNNN`) before the
next wave. A cherry-pick conflict means wave construction missed a file overlap —
abort the pick, fall the offenders back to sequential. No cross-wave parallelism.

---

## E. Step 3 — Strict reviewer (Opus High)

Once all tickets are on `release/v<X.Y.Z>` and the static gate is clean:

**Agent:** `anvil:strict-reviewer` (or `anvil:code-reviewer --strict`).
**Input:** `git diff main...release/v<X.Y.Z>`, the ticket ledger, the iron laws.

```
Review the full diff: git diff main...release/v<X.Y.Z>
Output JSON ONLY:
  { "critical": [{"file","line","ticket","finding","fix_hint"}],
    "high": [...], "medium": [...], "low": [...] }
Flag (Aegis iron-law + quality):
- Bun / TypeScript-runtime / build dependency introduced.
- Canonical content duplicated into adapters/<host>/ (must be projected, not copied).
- Hand-edited generated files (.claude-plugin/, .opencode/, .codex*/, adapters/*/skills|agents)
  or a hand-edited hook version stamp — must come from scripts/project.mjs.
- Frontmatter beyond the lean 5 fields + x-<adapter> namespace.
- An unsupported host capability shipped without an honest-gap note in adapters/<host>/projection.md.
- AGENTS.md / CLAUDE.md added outside the approved guidance folders.
- references/ writes (read-only).
- Validator regressions, surface-count drift, dead links.
- Secrets / personal paths / dangerous Unicode (cross-check the scans).
```

**Adjudication:** Critical → BLOCK (resolve before ship). High/Medium/Low → FIX
IN-RELEASE via Step 4 (nothing deferred to backlog mid-release). After fixes
land, re-dispatch the reviewer on the TIGHT diff (just the fixes). Loop until
`{"critical":[],"high":[],"medium":[],"low":[]}`.

---

## F. Step 4 — Fixer (Sonnet)

Per finding: dispatch `anvil:subagent-executor` with the verbatim reviewer note +
`file:line` + fix_hint + the same hard role boundary and static gate as D.3.
Fixer commits directly on `release/v<X.Y.Z>`:
`fix(release): AG-NNNN-review-<topic> — <one-liner>`. Convergence ceiling: 3
dispatches per finding, then escalate.

---

## G. Step 5 — Ship (sequential sub-steps; do NOT collapse)

| Sub-step | Mode |
|---|---|
| G.1 Pre-ship gate | Sonnet subagent |
| G.2 Commit release | Sonnet subagent |
| G.3 Push | INLINE |
| G.4 PR + merge | INLINE |
| G.5 Local cleanup | INLINE (`ExitWorktree`) |
| G.6 Tag | INLINE |

### G.1 Pre-ship gate (Sonnet) — mechanical, no decisions
```
CWD: the release worktree. Limited git to `git mv` / `git add` (NO commit/push/branch).
1. .aegis/plans/v<X.Y.Z>-plan.md: fill Validation Evidence (inventory + validator
   output); confirm every task checkbox is [x] or has a recorded deferral.
2. .aegis/plans/_roadmap.md: mark the v<X.Y.Z> row "(shipped)".
3. .aegis/tasks/AG-NNNN-*.md for this release: confirm each acceptance box is
   checked / resolved (tickets stay in .aegis/tasks/; no move required).
4. CHANGELOG.md: insert `## [v<X.Y.Z>] — YYYY-MM-DD` immediately after
   `## [Unreleased]` with a 4-6 bullet summary; CLEAR any stale content sitting
   under [Unreleased] that this release supersedes.
5. Version bump to X.Y.Z in: package.json (source of truth),
   .claude-plugin/plugin.json, .claude-plugin/marketplace.json, manifest/aegis.manifest.json.
   Then `node scripts/project.mjs` (re-stamps hook versions from package.json,
   regenerates .codex/plugins/aegis/.codex-plugin/plugin.json and
   .agents/plugins/marketplace.json from package.json — do NOT hand-edit those)
   and `node scripts/validate-structure.mjs` (must pass; plugin-manifests
   validator enforces version consistency).
6. If HTML/template coverage changed, update .aegis/index/html-templates.md.
7. `git add -A`. Do NOT commit.
Return: STATUS: ready|blocked:<reason> | FILES_STAGED: <n> | VERSION_FILES: <n>/4 |
        CHANGELOG_LINES: <n> | VALIDATE: ok
```

### G.2 Commit release (Sonnet)
Stage the G.1 set; ONE commit on `release/v<X.Y.Z>`:
```
release(v<X.Y.Z>): <theme one-liner from the plan>

<2-3 line summary>
```
No push, no PR, no merge.

### G.3 Push (INLINE — network/credentials)
```bash
( cd .worktrees/release-v<X.Y.Z> && git push -u origin release/v<X.Y.Z> )
```
Network failure → backoff 2s/4s/8s, then surface to owner.

### G.4 PR + merge (INLINE — `gh` uses the user's credentials)
```bash
gh pr create --base main --head release/v<X.Y.Z> \
  --title "release(v<X.Y.Z>): <theme>" --body-file .aegis/plans/v<X.Y.Z>-plan.md
gh pr merge <PR> --squash        # do NOT pass --delete-branch (see lesson 5)
git push origin --delete release/v<X.Y.Z>
```
**Do NOT pass `--delete-branch`** — inside a Claude worktree its local-cleanup
half fails (`'main' is already used by worktree`). The 3-step split (squash on
remote → delete remote branch → ExitWorktree for local teardown) avoids the
partial-state failure entirely.

### G.5 Local cleanup (INLINE — orchestrator drives the harness)
`ExitWorktree` is the only correct way to leave the worktree session and is
callable only from the orchestrator — subagent dispatch for G.5 is
architecturally impossible.
```
1. ExitWorktree(action: "remove", discard_changes: true)
   — discard_changes:true is correct: the worktree's individual commits live on
     the now-deleted release branch; after the squash-merge they exist on main as
     ONE squash commit. Content is preserved on main.
2. In the parent repo root:
   git fetch origin --prune
   git checkout main && git pull --ff-only origin main
   git log --oneline -3      # confirm the squash commit at HEAD
   git worktree list         # only the parent remains
```
If `ExitWorktree` refuses (untracked changes), surface to owner — do NOT
force-discard without inspection.

### G.6 Tag (INLINE) — required every release
Use an **annotated** tag (`-a`), never a lightweight one, so every release tag
carries a tagger, date, and message and the whole series stays consistent
(`git describe`, `git show <tag>`, and tooling all treat annotated tags as the
real release markers).
```bash
git tag -a v<X.Y.Z> -m "v<X.Y.Z> — <theme one-liner>"   # on the squash commit at main HEAD
git push origin v<X.Y.Z>
```
Verify with `git cat-file -t v<X.Y.Z>` → must print `tag` (a lightweight tag
prints `commit`). The historical `v0.0.8`–`v0.0.14` tags were backfilled
2026-06-14 as annotated tags; `v0.1.0` was re-created annotated for consistency.

---

## H. Adjudication

The inline orchestrator is the **sole arbiter**. Subagents return outputs; the
orchestrator gates retry budgets (planner 3, coder 2, fixer 3), routes reviewer
severities (Critical → block, others → fixer), and owns every defer-vs-fix call
(answer: fix in-release). Coder/Fixer commit on the release branch; all
push/branch/merge/tag operations are orchestrator-only.

---

## I. Failure handling

| Failure | Action |
|---|---|
| Planner blocked 3× on one ticket | Escalate — likely a ticket-completeness bug. |
| Coder not gate-clean in 2 retries | Escalate — likely a plan bug. |
| Strict reviewer Critical | Block; loop Step 4. |
| Strict reviewer High/Medium/Low | Fix in-release; do not defer. |
| Fixer not converging in 3 | Escalate — finding may be ill-formed. |
| Push fails (G.3) | Backoff 2s/4s/8s; then surface. |
| `gh` PR/merge fails | Surface immediately (auth/permissions). |
| `ExitWorktree` refuses | Inspect; do not force-discard. |
| Release branch has commits from another worktree | Halt — the release worktree must be the SOLE writer. |

---

## J. Conditional review gating

Stage-2 strict review (Step 3) MAY be skipped when the release is provably
non-code/low-risk — **declarative intent + mechanical override**. The cheap
planner-side checks (D.2) are never skipped.

### J.1 Ticket `Category:` matrix
| `Category:` | Strict review |
|---|---|
| docs, research, audit | SKIPPABLE |
| impl, validator, security, fix, feat, hardening, refactor | MANDATORY |

### J.2 Mechanical override (the grep that makes the skip safe)
```bash
( cd .worktrees/release-v<X.Y.Z> &&
  git diff --name-only main..release/v<X.Y.Z> |
  grep -qE '^(skills|agents|commands|hooks|rules|templates|statuslines|manifest|scripts|adapters|\.claude-plugin|\.opencode|\.codex)/' ) \
  && echo "code/surface touched — strict review FIRES regardless of declaration" \
  || echo "docs/.aegis-only — strict review skippable"
```
- Exit 0 (code/surface touched) → strict review FIRES; the declaration was wrong.
- Exit 1 (only `docs/`, `.aegis/`, root prose) → honor the skip.

Never honor a declared skip without running this grep — the override is what
keeps the gate from becoming a loophole.

---

## K. Anti-patterns (do NOT)

- Delegate the branch cut (Step 1), push (G.3), PR+merge (G.4), local cleanup
  (G.5), or tag (G.6) to a subagent — all inline-orchestrator ops.
- Run more than 2 subagents at once, ever (default 1). The 5-parallel general
  orchestration default does NOT apply to release work.
- Have a Coder/Fixer push, branch, merge, cherry-pick, or `reset --hard`.
- Edit a canonical surface without re-running `node scripts/project.mjs` and
  committing the generated changes in the same commit.
- Hand-edit a generated host file (`.claude-plugin/`, `.opencode/`, `.codex*/`,
  `adapters/*/skills|agents`) or a hook version stamp.
- Gate verification post-commit (forces a history-polluting `git reset`).
- Pass `--delete-branch` to `gh pr merge` from inside the worktree.
- Defer findings to backlog mid-release.
- Echo the planner's plan body back through the orchestrator (return path + 5
  lines only).
- Skip §J's override grep when honoring a declared skip.
- Ship without a tag (§G.6).
- Introduce Bun, a TypeScript runtime, a build step, or a user CLI (iron law).

---

## L. Why this shape

Model-tier routing puts Opus where bad output cascades (planning, review) and
Sonnet where work is well-specified (coding, fixing, mechanical ship). The
1-default / 2-ceiling concurrency cap is a hard lesson from a usage-limit
incident. Pre-commit gating + a single-writer release branch keep history clean.
Release-granularity strict review catches integration drift per-ticket review
misses. The inline orchestrator as sole arbiter of branch/network/main keeps
decision authority where the broadest context lives, and keeps credentials and
irreversible operations out of subagent hands.
