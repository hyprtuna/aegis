# Aegis Codex Plugin — Rules

## Iron Laws

1. **No user CLI.** Aegis is plugin-first. Users do not install a binary. Maintainer-only Node scripts.
2. **Canonical is the source of truth.** `skills/`, `agents/`, `commands/`, `hooks/`, `rules/`, `templates/`. Host-native files (`.claude-plugin/`, `.cursor/rules/`, `.rules`, etc.) are generated or hand-shimmed; never the canonical source.
3. **Lean frontmatter.** 4 fields: `name, description, visibility, platforms`. (`kind` is retired — no host recognised it, the projector already discarded it, and a surface's kind is stated by its directory. The `FRONTMATTER` validator now rejects it.) Plus `source: anvil:<path>` on migrated items. Adapter-specific metadata uses `x-<adapter>` namespace.
4. **Abilities are not skills.** Parent `SKILL.md` is the only registered skill. `abilities/<x>.md` are on-demand fragments — no frontmatter or minimal, NOT registered.
5. **Sparse guidance.** `AGENTS.md` + `CLAUDE.md` only at repo root and at each main surface folder root.
6. **Honest gaps.** Unsupported host capabilities go in `adapters/<host>/projection.md` as explicit gaps, never silently dropped.
7. **Fast validation.** `scripts/validate-structure.mjs` must complete in <30s.

# Rules

## agentic-engineering

# Agentic Engineering

Principles for engineering workflows where agents perform most implementation work and humans enforce quality and risk controls. Follow these rules when decomposing tasks, routing models, and managing multi-agent sessions.

## Operating Principles

1. **Define completion criteria before execution** — what does "done" look like? Write it down before starting any unit of work.
2. **Decompose into agent-sized units** — each unit independently verifiable, single dominant risk, clear done condition.
3. **Route model tiers by task complexity** — do not pay Opus rates for boilerplate transforms.
4. **Measure with evals** — capture failure signatures before implementation; re-run after to confirm the delta.

## Task Decomposition — The 15-Minute Rule

Each work unit should be completable by a subagent in roughly 15 minutes. A unit is the right size when:

- It has a single dominant risk (the thing most likely to go wrong).
- Its outcome is independently verifiable (a test, a type check, a diff review).
- It has an unambiguous done condition written before execution starts.

Split when a unit touches more than two layers or requires more than two tool call types. Merge when two units would need to share context that cannot be cleanly passed as a message.

## Model Tier Routing

| Tier | Use for |
|---|---|
| Haiku | Classification, boilerplate transforms, narrow slot-fill edits, commit message generation |
| Sonnet | Implementation, refactors, multi-file edits within a defined spec |
| Opus | Architecture design, root-cause analysis spanning multiple codebases, multi-file invariant reasoning |

Escalate model tier only when the lower tier fails with a clear reasoning gap — not for comfort or speed.

## Parallel Subagent Dispatch

Spawn parallel subagents when:
- Work units are independent (no shared mutable state, no ordering dependency).
- The task set is homogeneous (same kind of work, different targets).
- Combined latency savings outweigh orchestration overhead.

Do not spawn parallel agents when:
- Units have sequential dependencies (output of A is input of B).
- Failure in one unit requires rollback of others.
- The total token spend would exceed the benefit.

## Session Strategy

- Continue the same session for closely coupled work units that share large context.
- Start a fresh session after major phase transitions (design complete, now implementing; implementation complete, now testing).
- Compact after milestone completion, not during active debugging — compacting mid-debug loses failure context.

## Review Focus for Agent-Generated Code

Prioritize human review on:
1. **Invariants and edge cases** — agents satisfy the happy path; review the boundaries.
2. **Error boundaries** — what happens when a dependency fails?
3. **Security and auth assumptions** — agents may not know the trust model.
4. **Hidden coupling** — changes that look isolated but break distant contracts.
5. **Rollout risk** — is this change reversible if it misbehaves in production?

Do not spend review cycles on style disagreements when a linter already enforces style automatically.

## Cost Discipline

Track per task unit:
- Model tier used
- Token estimate before / actual after
- Retry count
- Wall-clock time
- Success / failure

Escalate tier only when the lower tier fails with a reasoning gap. Haiku handles more than most teams expect — try it before assuming Sonnet is required.

## Eval-First Loop

1. Define the capability eval (what should the system do?) and regression eval (what should it not break?).
2. Run baseline and record failure signatures.
3. Execute the implementation.
4. Re-run evals and compare deltas. Accept only if capability improves and regressions stay zero.

## coding-standards

# Coding Standards

Baseline coding conventions applicable across all languages and project types. This is the shared floor — language overlays add language-specific rules on top.

Reach for the language overlay first. Use this skill when:
- Starting a new project or module from scratch.
- Reviewing code for cross-cutting quality concerns.
- Enforcing naming, readability, or structural consistency across a polyglot codebase.
- Onboarding a contributor to general conventions before language-specific ones.

## 1. Readability First

- Code is read far more often than it is written. Optimize for the reader, not the author.
- Clear, descriptive names at every scope.
- Self-documenting code over comments; comments explain *why*, not *what*.
- Consistent formatting enforced by a tool, not by convention.

## 2. Naming

| Scope | Pattern |
|---|---|
| Variables / properties | Descriptive noun or noun phrase: `marketSearchQuery`, not `q` |
| Boolean variables | Read as a true/false statement: `isUserAuthenticated`, `hasPermission` |
| Functions / methods | Verb-noun pair: `fetchMarketData`, `calculateSimilarity`, `isValidEmail` |
| Constants | Screaming snake in languages that support it: `MAX_RETRIES`, `DEBOUNCE_DELAY_MS` |
| Files | Follow the project's established casing; never mix casing styles within a directory |

Avoid single-letter names outside loop counters and well-known mathematical conventions.

## 3. Immutability by Default

Prefer immutable data. Mutate only when there is a clear performance or ergonomic reason, and document it.

- Declare variables as constants / `val` / `const` / `final` wherever possible.
- Return new values from functions rather than mutating arguments.
- Use spread / copy constructors for updates rather than in-place mutation.

## 4. KISS, DRY, YAGNI

**KISS** — the simplest solution that correctly solves the problem. Avoid abstraction layers that do not pay for themselves today.

**DRY** — extract logic that appears in more than two places. Tolerate one duplication; remove the second.

**YAGNI** — do not build features before they are needed. Speculative generality adds maintenance surface with no immediate benefit.

## 5. Error Handling

- Every error must be handled or explicitly propagated. Silent swallowing is always a bug.
- Log enough context to diagnose the problem server-side (IDs, operation, error message).
- Return generic messages to external callers — never expose stack traces, SQL errors, or internal paths.
- Handle errors at the layer that has enough context to do something useful; propagate upward otherwise.

## 6. Function Size and Nesting

- Functions longer than 50 lines are candidates for extraction.
- Nesting deeper than 3 levels is a signal to extract a function or invert the condition (early return / guard clause).
- One function, one responsibility — if you need "and" in the description, split it.

## 7. Avoid Magic Numbers and Strings

Name every constant that has non-obvious meaning:

```
BAD:  if retryCount > 3: ...
GOOD: MAX_RETRIES = 3 / if retryCount > MAX_RETRIES: ...
```

## 8. Async / Concurrency

- Prefer structured concurrency primitives over raw threads or unscoped goroutines/coroutines.
- Run independent operations in parallel when they have no ordering dependency.
- Do not mix sync and async I/O in the same execution context.

## 9. Tests

- Tests are named to describe behavior, not implementation: `returns empty list when user not found`, not `testGetUser`.
- Arrange / Act / Assert structure. One logical assertion per test where practical.
- Tests are documentation — a passing test suite is the spec.

## 10. Comments

Write comments that explain *why* a choice was made, not *what* the code does:

```
BAD:  # Increment counter
GOOD: # Use exponential backoff to avoid overwhelming the API during outages
```

Outdated comments are worse than no comments — delete them.

## Code-Smell Checklist

Before marking any unit of work complete, verify:

- [ ] No magic numbers or unexplained string literals
- [ ] No commented-out code committed
- [ ] No `TODO` without a linked issue or a date
- [ ] No silent error swallowing
- [ ] No function longer than 50 lines without justification
- [ ] No nesting deeper than 3 levels without a guard-clause refactor
- [ ] No duplication introduced without a plan to remove it

## context-budget

# Context Budget

Analyze token overhead across every loaded component and surface the top optimizations to reclaim context headroom. Run this before spawning a long subagent chain or after adding several new components.

## When to Use

- Session quality is degrading or output feels truncated.
- Many skills, agents, or MCP servers were recently added.
- Planning a long multi-agent task and need to know available headroom.
- Orchestrator pre-flight before a complex parallel dispatch.

## Phase 1 — Inventory

Estimate token consumption per component category. Use `words × 1.3` for prose; `chars / 4` for code-heavy files.

| Category | Location | Flags |
|---|---|---|
| Agents | `agents/*.md`, `.claude/agents/*.md` | description > 30 words (loaded on every Task invocation); file > 200 lines |
| Skills | `skills/**/*.md` | file > 400 lines; identical copies across skill directories |
| Rules | `rules/**/*.md`, `skills/universal/rules/*.md` | file > 100 lines; content overlap within category |
| MCP Servers | `.mcp.json` or active MCP config | ~500 tokens/tool schema; > 20 tools per server; servers wrapping CLI tools already available as shell commands (`git`, `gh`, `npm`) |
| CLAUDE.md chain | project + user-level, combined | combined total > 300 lines |

## Phase 2 — Classify

Sort every component into one of three buckets:

| Bucket | Criteria | Action |
|---|---|---|
| Always needed | Referenced in CLAUDE.md, backs an active command, or matches current project type | Keep |
| Sometimes needed | Domain-specific but not in active use for this task | Consider on-demand activation |
| Rarely needed | No command reference, overlapping content, no project match | Remove or lazy-load |

## Phase 3 — Detect Issues

| Issue | Threshold | Impact |
|---|---|---|
| Bloated agent description | > 30 words | Loaded on every Task tool call |
| Heavy agent file | > 200 lines | Inflates Task context on every spawn |
| Redundant skill/rule | Duplicate content across files | Silent token waste |
| MCP over-subscription | > 10 servers or CLI-wrapping servers | Often the single largest lever |
| CLAUDE.md bloat | > 300 combined lines | Loaded at session start |

## Phase 4 — Report

```
Context Budget
══════════════════════════════════════
Total overhead:     ~XX,XXX tokens
Effective headroom: ~XXX,XXX tokens (XX%)

Component Breakdown
───────────────────
Agents      N files    ~X,XXX tokens
Skills      N files    ~X,XXX tokens
Rules       N files    ~X,XXX tokens
MCP tools   N tools    ~XX,XXX tokens
CLAUDE.md   N lines    ~X,XXX tokens

Top Optimizations
─────────────────
1. [action] → save ~X,XXX tokens
2. [action] → save ~X,XXX tokens
3. [action] → save ~X,XXX tokens

Potential savings: ~XX,XXX tokens (XX% of current overhead)
```

## Phase 5 — Behavioral Signs (Qualitative)

Phases 1–4 answer "how much budget exists" from token math. This phase answers "what state is the session in right now," read directly from observable behavior — no token count required. It complements the inventory rather than replacing it, and closes the gap left when the context-window MONITOR was retired: the monitor could never know the real ceiling (it varies by model and host), but behavioral signs need no ceiling at all. Use inventory for pre-flight planning; use behavioral signs for continuous in-session awareness, since state can shift mid-session even when the pre-flight inventory looked fine.

| Tier | Signals | Action |
|---|---|---|
| PEAK | Sharp, full recall, precise answers | Proceed normally |
| GOOD | Solid work, some overhead | Proceed; stay mindful before new heavy loads |
| DEGRADING | Re-reading files already seen; minor contradiction of earlier decisions; slower convergence | Wrap up the current thread soon; checkpoint progress |
| POOR | Forgetting earlier decisions; truncated or rushed output; repeating completed work; losing the thread | Stop; checkpoint to disk; compact or hand off to a fresh session |

## Best Practices

- **MCP is the biggest lever** — a 30-tool server costs more than all skills combined.
- **Agent descriptions are always loaded** — even unspawned agents inflate every Task tool context via their description.
- **Audit after every addition** — run after adding any agent, skill, or MCP server to catch creep early.
- **Verbose mode for debugging** — use when you need per-file breakdowns, not for regular audits.

## decision-template-discipline

# decision-template-discipline

> **Scope lane — WHAT-questions.** Fires when a skill renders a decision template carrying a real question — which option / approach / design? — and STOP-and-WAITs for the user's answer (unless a carve-out applies). Sibling (kept separate, do not merge): `user-choice-discipline` governs the **WHERE/HOW** dimension — output location and format — via `AskUserQuestion`. This rule owns the "which substantive choice?" wait only; it does not touch the location/format fork.

## The rule

<HARD-GATE phase="decision">
When a skill renders a `${TEMPLATE:decisions}` block carrying a real
question (not a placeholder, not example prose), STOP and WAIT for the
user's answer before continuing.

This gate lifts ONLY when one of the following carve-outs applies:

1. **Accept-defaults carve-out.** The user explicitly authorised defaults
   for this run — `--accept-defaults` flag, `auto_decisions: true` in the
   runtime context, or an equivalent opt-in. The agent emits the
   recommended option, logs an audit-trail entry, and proceeds.

2. **Auto-mode + high-confidence carve-out.** Auto-mode is active AND the
   prompt's `confidence` field is `'high'`. The agent emits the
   recommended option, logs an audit-trail entry, and proceeds.

Anywhere else — auto-mode active but confidence missing/low/medium, no
recommended option, multiple recommendations, or no explicit opt-in — the
agent WAITS. Free-form prose, ambiguous "sounds good" replies, and silent
defaults do NOT satisfy this gate.
</HARD-GATE>

## Why this exists

Decisions are the most expensive thing to get wrong. The cheapest moment
to redirect a plan is *before* the agent commits to one of the options;
the most expensive is after the diff lands. The decision template
surfaces the choice as a structured question with options and a
recommendation; this rule ensures the surface is *honoured* — the agent
treats the prompt as a real interaction, not decoration.

Auto-mode is dangerous here. Without this rule, an autonomous run would
silently pick the recommendation every time and the user would discover
the choice in the commit log. The carve-outs above are intentional and
narrow:

- `--accept-defaults` is an *explicit* user authorisation. The user told
  us to skip waits; we comply.
- `auto-mode + confidence: 'high'` is a deliberate calibration signal. A
  skill that emits a high-confidence recommendation is asserting "this
  one's routine — proceed." Anything below that bar waits.

## When to use

- Any skill that produces a `${TEMPLATE:decisions}` block at runtime
  (`design-exploration`, `implementation-planner`, `architecture-decision-record`,
  `framework-selection`, `brainstorm-spec`, …).
- Any agent that consumes a decision prompt rendered by such a skill.

## Auto-mode contract

When auto-mode is active, the runtime must determine whether to auto-select or wait.
The decision logic:

1. If `acceptDefaults` is explicitly set → auto-select the recommended option and log an audit entry.
2. If auto-mode active AND `confidence === 'high'` → auto-select and log an audit entry.
3. Otherwise → surface the prompt and WAIT.

The audit entry must record: the prompt question, the selected label, the timestamp, and the reason for auto-selection (accept-defaults or auto-mode + confidence).

## Anti-patterns

- **Silent defaults.** Emitting a recommendation in the body and then
  acting on it without an explicit user signal. This is the failure mode
  the rule was written to prevent.
- **Stretching "approved".** A vague "sounds good" or "ok" is not a
  selection. The user MUST name an option label.
- **Lowering the bar.** Treating `confidence: 'medium'` as eligible for
  auto-select. The bar is `'high'` and only `'high'`.
- **Skipping the audit log.** Even when auto-select is correct, the
  audit-trail entry is mandatory. It is the user's only retroactive view
  into what the agent decided on their behalf.

## evidence-before-assertion

# evidence-before-assertion

> **Scope lane — every prose claim.** Fires whenever you write a factual statement about code, state, or behaviour: cite concrete evidence (file:line, command output, test name), never inference. Siblings (kept separate, do not merge): `verification-before-completion` governs the "done" *completion gate* (run the proving command, show output); `rationalization-prevention` governs every *skip/downgrade/defer* decision. This rule owns the "is this claim backed by evidence?" check only.

## The rule

<HARD-GATE phase="claim">
Every claim you write about the codebase — that a function exists, that a test passes, that a change is safe — must carry concrete evidence. A file path and line number. A command and its output. A commit hash. A test name. Inference is not evidence.

letter = spirit: the intent of this gate is that every factual claim is *independently verifiable* by the reader, *now*, against the same tree. Citing "I checked earlier" or paraphrasing a prior result satisfies the letter (some checking happened) but violates the spirit (the reader cannot reproduce the verification from your text alone). The reference must be specific enough to retrace.

This gate lifts ONLY when:
- Every factual claim carries a `file:line` reference, command output, commit hash, or test name.
- The reference points at content that exists in the *current* tree, not memory of a prior tree.
- A reader can copy-paste each reference into their own session and reproduce the check.
</HARD-GATE>

## When to use

- Writing a PR description, review comment, commit message, or status update.
- Answering a user question about "does this code do X?"
- Composing any end-of-turn summary with claims about state.

## Red flags (thoughts that mean STOP)

| Thought | Reality |
|---|---|
| "I remember this from earlier" | Memory is unreliable. Re-check the file. |
| "It usually works this way" | Codebases are idiosyncratic. Check this one. |
| "The user said so, so it's true" | User can be wrong or out of date. Verify. |
| "The docs say it does that" | Docs drift from code. Check the code. |
| "I scanned it a minute ago" | Minute-ago memory compressed. Quote the line. |
| "Naming the path is enough — I don't need to read it again" | Paths drift between sessions. Re-grep, then cite. |

## Exit condition

Every factual claim in your output is accompanied by a concrete reference: `src/foo.ts:42`, `rg -n "pattern"` output, `bun test --run foo` result. Claims without references get struck.

## Why

Assertions without evidence create false consensus. The first person to claim "this works" sets the narrative; every downstream reader assumes it. Evidence is the cheap way to prevent that cascade.

## memory-discipline

# memory-discipline

Applies to any agent with `x-claude.memory` or any workflow that writes to `MEMORY.md`.

## Observation taxonomy

Every MEMORY.md entry carries a `type` drawn from this closed set:

| Type | When to use |
|---|---|
| `discovery` | A non-obvious fact about the codebase, API, or environment. |
| `decision` | A choice made and the reasoning behind it. |
| `blocker` | An unresolved problem or dead-end worth remembering. |
| `progress` | A milestone or completion state worth persisting across sessions. |
| `bugfix` | An error→fix pattern — root cause + minimal fix. |
| `change` | A significant structural or behavioral shift to the project. |

## Which store?

Don't dump everything in one store — route each learning to the store that matches
its lifetime:

| Store | Use for | Not for |
|---|---|---|
| `MEMORY.md` | Durable, project-specific facts an agent needs across future sessions (see taxonomy above). | Guidance every contributor/agent needs up front — that's `AGENTS.md`/`CLAUDE.md`. |
| `AGENTS.md` / `CLAUDE.md` | Repo/project conventions, iron laws, workflow rules — loaded every session, human-authored. | Session-scoped facts, one-off discoveries, anything that will go stale within a task. |
| Ephemeral scratch (scratchpad, task notes) | Session-only working state — intermediate results, in-flight reasoning. | Anything the next session or another agent needs to recall — promote it to `MEMORY.md` first. |

**Do not store:** duplicates of an existing entry (supersede instead, per Curation
discipline), facts that are stale or task-complete, or anything derivable by reading
the code/config directly (a fact that a `grep`/`Read` recovers cheaply doesn't earn a
permanent slot).

## Entry shape

Each entry uses this structure so Grep and the `recall` skill can index it reliably:

```markdown
## <title>

- **type:** <type>
- **facts:** <concise bullet list — concrete, verifiable>
- **narrative:** <one-paragraph reasoning or context>
- **concepts:** <comma-separated keywords for grep>
- **files:** <comma-separated file paths, if relevant>
```

Keep `facts` immutable (code, paths, commands, versions — never paraphrase).
Keep `narrative` short; compress only prose, never the `facts` list.

## Curation discipline

Curate MEMORY.md when it exceeds **200 lines or 25 KB** (the native auto-inject cap):

1. **Preserve-exactly.** `facts`, inline code, paths, commands, and version numbers are
   read-only regions — compress only prose around them, never the data itself.
2. **Promote recurring patterns.** If the same root cause or fix appears more than
   once, merge into a single entry with a `count` annotation.
3. **Supersede contradictions.** When a newer entry overrules an older one, delete the
   old entry entirely — do not keep both. Add a `supersedes:` note in the new entry.
4. **Drop resolved blockers.** Remove `blocker` entries once the issue is resolved;
   optionally promote a summary to a `decision` or `bugfix` entry.

After curation, verify the structure survived: every remaining entry still has the
`type / facts / narrative / concepts` fields and a level-2 heading.

## Secret-scan write discipline

Before writing any entry to MEMORY.md, apply the same discipline as `secret-scan.sh`:

- **Never write** API keys, tokens, passwords, private keys, or any credential to
  MEMORY.md — they persist across sessions and may be injected into subagent context.
- **Never write** personally-identifying information (names, emails, phone numbers).
- If a fact you want to record contains a secret value, redact it to a placeholder
  (e.g. `API_KEY=<redacted>`) before writing.
- If you are uncertain whether a value is a secret, omit it.

This discipline mirrors the `scripts/secret-scan.sh` policy. **There is no automated
enforcement at the write boundary** — `MEMORY.md` lives in host-managed agent-memory
directories outside repo scans, so the secret-scan script does not run at write time.
This is a model-followed convention, not a mechanical gate. Memory writes carry the
same risk as committing a secret to git — treat them with the same care.

## one-percent-rule

# one-percent-rule

## The rule

If there is even a 1% chance that a named skill applies to what you're doing, invoke it. Checking is cheap. Guessing wrong is expensive. The cost of a misfire is seconds; the cost of silent drift is compound.

## When to use

- About to answer a user question without checking for an applicable skill.
- About to implement a feature, fix a bug, review code, or plan anything.
- Faced with a task that is routine or familiar — especially then.

## Red flags (thoughts that mean STOP)

| Thought | Reality |
|---|---|
| "It's just a small change" | Small changes drift. Skills prevent drift. |
| "I already know how to do this" | Knowing ≠ doing it consistently. |
| "This skill is overkill" | Overkill is cheap. Under-discipline is expensive. |
| "I'll check the skill later" | Later never arrives in practice. |
| "The skill doesn't exactly fit" | Partial fit > no fit. Read it; adapt. |

## Exit condition

You have either (a) invoked the relevant skill via the Skill tool, or (b) explicitly declared and justified why it does not apply. A silent skip is a violation.

## Why

The entire point of shipping skills is consistency under pressure. When you're rushed, the 1% rule is what turns a good plan into a followed one. Without it, skill adoption drops the moment the work gets interesting.

## orchestrator-first

# orchestrator-first

## The rule

When the routing banner above the prompt is a **directive** (multi-line, confidence ≥ 75%, naming a specific agent), your first action is to delegate to that agent. Do not start reading files, drafting code, or answering inline — dispatch first, then react to what the agent returns.

## When to use

- A multi-line directive block appears above the user's prompt.
- The banner lists a specific agent (not `main`).
- The user has not already invoked a different agent or skill explicitly.

## What "delegate first" means

- Invoke the named agent via the `Task()` / `Agent` tool with the named subagent type.
- Pass the user's prompt verbatim plus the routing preamble (the `[routing]` block under the banner).
- Attach the named skills and rules as context for the agent.
- Resume only after the agent returns a result — do not run interleaved work.

## Carve-outs (inline is OK)

| Situation | Why inline is fine |
|---|---|
| User explicitly invoked a different agent (`@agent`, `/skill`) | Explicit override beats the directive. |
| Task is truly trivial (≤ 1 file, ≤ 10 lines, no verification needed) | Dispatching adds latency with no parallelism benefit. |
| Banner is advisory (single line, no `DIRECTIVE` marker) | Router is not confident enough to force delegation. |
| Banner is `fallback=main` or `fallback=ask` | Router deferred to main / user — do not dispatch. |

## Red flags (thoughts that mean STOP and delegate)

| Thought | Reality |
|---|---|
| "I can just do this myself, it's faster" | Faster for this turn; the directive exists because router evidence says this task class benefits from the specialist. Dispatch. |
| "I'll read the files first to understand, then decide" | Reading *is* doing inline. Dispatch and let the agent read. |
| "The agent would just do what I'd do" | Then dispatching costs nothing and gains consistency. Dispatch. |
| "Directive is probably wrong for this one" | If confidence ≥ 75% the router has evidence. Respect the directive; user can override explicitly. |

## Why

The directive threshold was calibrated so that only high-evidence routes produce it. When it fires, the specialist agent has a structural advantage (tighter prompt, targeted skills, appropriate rules). Overriding the directive silently reverts the session to generalist mode and loses that advantage without the user noticing. Explicit override is fine; silent override is not.

## Decision tree — skill vs agent vs command

If delegating, decide the primitive **first** — never assume.

```
Does this need a fresh context window?           → Agent
Is this a discipline / rule / methodology?       → Skill
Is this a CLI / project-state action?            → Command
```

Slug grammar makes the choice lexically:
- **Agents** end in approved doer-suffixes (`-er`, `-or`, `-architect`, `-builder`, `-worker`, `-explorer`, `-orchestrator`, `-validator`, `-resolver`, `-surfacer`, `-selector`, `-analyzer`, `-simplifier`, `-verifier`, `-reviewer`, `-hunter`).
- **Skills** end in activity-noun forms (`-ing`, `-ion`, `-design`, bare nouns like `research`).
- **Commands** begin with a verb (`init`, `plan`, `review`, `finish`, ...).

If you reach for the Agent tool with an `-ing`-form slug, the slug is telling you to use the Skill tool.

## protected-branch-discipline

# protected-branch-discipline

## What this covers

Aegis has no runtime mechanism that blocks or prompts before a push to a shared
trunk (`git push origin main`) — the judgment is entirely the agent's to apply
before pushing. This rule carries that judgment: whether the trunk is the right
destination for THIS change, plus the enforcement options a team can reach for
when it wants more than an agent's own discretion.

Applying this rule is not a verdict on the change itself. Don't treat a decision
to push directly as vindication or a decision to branch instead as an error; both
are judgment calls, not outcomes to be graded.

## When the trunk is the right target

- The repo's own history shows it — recent commits land directly on the trunk with
  no merge commits and no short-lived branches. Read `git log --oneline` before
  assuming otherwise. Trunk-based development is a mainstream, respected model.
- The change is trivially reversible: a typo fix, a version bump, a generated file
  regenerated from its source.
- The user asked for it explicitly, in this session, for this change.

## When to propose a branch instead

- The change is large enough to want review, or touches code you cannot fully verify.
- CI is the only thing between the change and a deploy.
- Other people are working on the same files right now.
- You are midway through a multi-step task and the trunk would be left half-finished.

In any of these, say so in one line before pushing, and propose the branch instead.
Give the user the reason, not just the choice.

## How a team gets a hard block

Nothing in Aegis enforces this — the judgment above is advisory, applied by the
agent per call. A team that wants an actual block needs a native mechanism —
both of these are stronger than anything an agent can enforce from inside a
session, because they also bind humans and CI:

- **Forge-side branch protection** — GitHub/GitLab branch protection rules on the
  remote. Cannot be worked around from a local shell.
- **A local `pre-push` git hook** — rejects the push in the developer's own repo:

  ```bash
  # .git/hooks/pre-push — reject pushes to main
  while read -r _ _ remote_ref _; do
    case "$remote_ref" in
      refs/heads/main|refs/heads/master)
        echo "pre-push: direct push to ${remote_ref##*/} is blocked" >&2
        exit 1 ;;
    esac
  done
  ```

Point the user at these when they ask for enforcement. Do not offer to disable either.

## Red flags

| Thought | Reality |
|---|---|
| "Nothing stopped me, so a direct push must be fine" | Nothing enforcing this is not the same as nothing to judge. Apply the rule yourself before every trunk push. |
| "The user approved a push once, so I'll stop mentioning it" | Each push is its own decision. Raise the question again next time it applies. |
| "The user said branch, but a direct push is faster" | Their branching model is theirs. Faster is not a reason. |
| "Branch protection rejected my push, I'll force it" | Force-push overwrites remote history. Fix the branch; don't work around a protection failure by forcing it. |
| "I'll add a pre-push hook to block this for them" | Only if asked. Enforcement is a team decision, not an agent's default. |

## rationalization-prevention

# rationalization-prevention

> **Scope lane — every skip/downgrade/defer decision.** Fires the moment you feel the urge to skip a check, downgrade a finding, or defer work: name the rationalization, don't act on it. Siblings (kept separate, do not merge): `verification-before-completion` governs the "done" *completion gate*; `evidence-before-assertion` governs every prose *claim*. This rule owns the "am I talking myself out of the right step?" check only.

## The rule

Under pressure, the mind invents plausible reasons to skip the right step. Spot the rationalization pattern. Name it. Don't act on it. If the pattern is legitimate, it will survive being named.

## When to use

- About to skip a verification command, code-review step, or implementation-planner phase.
- About to downgrade a finding from "blocker" to "nice-to-have" without new evidence.
- About to defer work you were about to do because "it's not really related."

## Red flags (thoughts that mean STOP)

| Thought | Reality |
|---|---|
| "This edge case is unlikely" | Unlikely is the top cause of outages. |
| "I'll fix it later" | Later = never. Fix it now or file it with an owner. |
| "The user probably won't notice" | Users always notice the thing you skipped. |
| "It's not in scope" | Scope drift is a decision — make it one, not a drift. |
| "I'm tired, I'll come back to it" | Tired-future-you is the same rationalizer. |

## Exit condition

Either the original step is completed, or the rationalization is written down in the commit message / PR description / work log with a concrete reason a human can challenge.

## Why

Every incident has a postmortem that contains a rationalized skip. This rule makes the skip visible at the moment it happens, when it is still cheap to reverse.

## scratch-dir-convention

# scratch-dir-convention

## The rule

When you tell a subagent to write a report, brief, diff, or any intermediate
artifact to a file, that file MUST live in a writable, git-ignored working-tree
directory — never under `.git/`.

**Claude Code treats `.git/` as a protected path and DENIES agent writes there.**
A dispatch that says "write your report to a `.git/`-path file" (or any
`git rev-parse --git-path` target) fails silently: the handoff breaks and the
controller gets nothing back.

## The convention — one-shot, stateless, no runtime

Resolve a self-ignoring scratch dir at the working-tree root and hand subagents
ABSOLUTE paths inside it:

```bash
SCRATCH="$(git rev-parse --show-toplevel)/.aegis-scratch"
mkdir -p "$SCRATCH" && printf '*\n' > "$SCRATCH/.gitignore"
# e.g. dispatch a subagent to write "$SCRATCH/report-<task>.md"
```

- `git rev-parse --show-toplevel` is worktree-correct (resolves the working tree, not `.git/`).
- `printf '*\n'` writes a `.gitignore` that ignores everything including itself —
  the dir stays out of `git status` and out of accidental commits, and no tracked
  file is modified.
- Pure one-shot bash. No daemon, no state file, no cleanup hook. Re-running is idempotent.

## Why

The entire file-handoff orchestration pattern (a controller dispatches a subagent,
the subagent writes its result to a file, the controller reads it back) depends on
the write target being writable AND ignored. `.git/` satisfies neither. Pass an
absolute `.aegis-scratch/` path and the handoff is reliable, invisible to git, and
needs no teardown.

## Red flags

| Thought | Reality |
|---|---|
| "I'll have the agent write to `.git/aegis/report.md`" | Claude Code denies the write; the handoff silently breaks. Use `.aegis-scratch/`. |
| "Relative `./scratch/out.md` is fine" | A subagent's cwd may differ; relative paths drift. Hand an ABSOLUTE path. |
| "I should add a cleanup step / state file" | No — the self-ignoring `.gitignore` is the whole mechanism. Stateless by design. |

## skeptical-stance

# skeptical-stance

## Skeptical-by-default

Most agents keep a neutral, cooperative voice. A small set of review/verify agents
instead open **skeptical-by-default**:

- **Claims are wrong until evidence proves them right.** "This works", "this is
  done", "tests pass" are claims to check against concrete evidence, never taken on
  faith.
- **No rubber-stamping.** A clean review is earned, not granted. An empty finding
  list is valid only after the agent has actually tried to disprove the work.
- **No grading on effort.** The bar is correctness, safety, and maintainability —
  not how hard the author tried.

This is the "guilty until proven innocent" stance for code, plans, and docs. It is
**opt-in per agent**: agents that do not carry it keep their neutral voice.

## The opt-in field

An agent opts in by declaring, under its `x-aegis:` frontmatter block:

```yaml
x-aegis:
  stance: skeptical
```

`x-aegis.stance: skeptical` is the single discoverable marker. The field and the
body must agree: an agent carrying the skeptical voice in its body declares the
field, and an agent declaring the field opens with the skeptical framing. The
`STANCE` validator (`scripts/validate/stance.mjs`) cross-checks both directions
and warns on drift.

## Opted-in agents

Three agents carry the skeptical stance today:

- **`code-reviewer`** — the single public reviewer; skeptical on every pass.
- **`code-quality-reviewer`** — the internal Stage 2 quality reviewer.
- **`doc-verifier`** — fact-checks documentation against the live codebase.

## Strict-reviewer successor

Per an earlier review-agent consolidation, the former `strict-reviewer` agent was
folded into **`code-reviewer --strict`**: the adversarial lock-in / irreversible-
decision lens with `min_confidence: 0` (no finding dropped for low confidence).
`code-reviewer --strict` is the strict-reviewer successor; there is no separate
strict-reviewer agent. Skeptical-by-default (this rule) is the always-on baseline
for the three agents above; `--strict` is the additional high-stakes lens
`code-reviewer` layers on top when invoked.

## tdd-iron-law

# tdd-iron-law

## The rule

<HARD-GATE phase="implementation">
Red before green, every time. Write the failing test. Run it. See it fail. Only then write the implementation. When the test passes, refactor with the test as the safety net.

letter = spirit: the intent of this gate is that a failing test catches a real behavioral gap *before* any implementation exists. A test that passes on first run, or that is added after the implementation, satisfies the letter (a test exists) but violates the spirit (the test never proved a gap). The test must have been red *because* the behavior did not yet exist.

This gate lifts ONLY when:
- A new test or test case appears in the diff for the new behavior.
- The test ran and failed (output captured before the implementation was written).
- The implementation was written *after* the failure was observed.
</HARD-GATE>

## When to use

- Adding any new behavior: feature, endpoint, component, calculation, rule.
- Fixing any bug that a regression test could catch (almost always).
- Refactoring code covered by tests — extend the test first, then refactor.

## Red flags (thoughts that mean STOP)

| Thought | Reality |
|---|---|
| "I'll add the test after" | After means never. Write it first. |
| "It's too small to need a test" | Small changes break quietly. Test it. |
| "The test will be trivial" | Trivial tests document intent. Write it. |
| "I'll refactor without a test" | Untested refactors are rewrites. Add the test. |
| "There's no way to test this" | Then you don't understand the contract yet. |
| "Just this once — I'll backfill in the next commit" | Just-this-once is the canonical rationalization. The next commit never lands. Write the test now. |

## Exit condition

For every new piece of behavior: a test that existed, failed, and now passes. The test file is in the diff. The test-run output is visible.

## Why

TDD is not slower. It's the same work in a different order — one where the scariest step (the test) is cheapest because there's no implementation debt yet. Teams that skip TDD pay the cost in incident reports, not time savings.

## templates

# templates

## The template-authoritative model

When a skill or agent emits a named artifact, the **template is authoritative**:

- `${TEMPLATE:<kind>}` substitutes **verbatim** — it resolves to the kind's `default`
  format per `manifest/template-index.json` and the resolved body is dropped in as-is.
- `${TEMPLATE:<kind>:<format>}` substitutes an **explicit** format (`markdown` / `json` /
  `html`) the kind ships per the index.
- The **template owns layout, severity taxonomy, and section order.** It is the single
  source of truth for what the artifact looks like.
- Skills and agents carry **ONLY** the `${TEMPLATE}` reference plus rule links — never their
  own duplicated format, layout, or question-and-answer prose. If a producer body restates
  the artifact's format or taxonomy, that duplication is removed and the body relies on the
  template instead.

The location/format question flow (Q1 — where to store, Q2 — which format) is not a per-skill
concern either: it lives in `rules/user-choice-discipline.md`, which reads the kind's available
formats from `manifest/template-index.json`. Producers point at that rule rather than inlining
their own Q&A payloads.

### Why template-authoritative (audit §3 "code-review duality")

The surface audit (`.aegis/research/aegis-surface-audit.research.md` §3) flagged a duality for
the `code-review` kind: is the `${TEMPLATE}` an authoritative body the skill defers to, or a
"skeleton" the skill keeps its own Q&A and format prose alongside? The audit's recommendation —
adopted here as the canonical model — is **template-authoritative**: the template body is the
real thing, the skill shrinks to a reference. The rejected alternative was the "skeleton" model
(skill keeps duplicated format/Q&A prose) and the "strip HTML+JSON from the kind" option. This
rule generalizes the decision: template-authoritative is the contract for **every** kind, not
just `code-review`.

### How to apply

1. Identify the artifact kind (a key in `manifest/template-index.json`).
2. In the producer body, reference `${TEMPLATE:<kind>}` for the working default, and
   `${TEMPLATE:<kind>:<format>}` for an explicit non-default format on request.
3. Honor the kind's index `default` (per `user-choice-discipline`). Where the index `default`
   is `html` but the working artifact is prose, request `${TEMPLATE:<kind>:markdown}` explicitly
   rather than silently flipping the index default.
4. Do NOT restate the template's layout, section order, or severity taxonomy in the producer.
   Remove any such duplication and rely on the substituted template body.
5. Defer the location/format question flow to `rules/user-choice-discipline.md`.

## Named-artifact rule

Any skill or agent that emits a **named artifact** MUST reference a template kind — via a
`${TEMPLATE:<kind>}` reference — **or** carry a `// REASON:` note justifying why no template
applies.

A **named artifact** is a durable, structured output the producer writes or hands off: a review,
a plan, a spec, a research report, a plan-audit report, a design system, a PR writeup, a concept
explainer, and the like — anything a downstream reader or tool consumes as a file or a named
deliverable. Ephemeral conversational prose (an inline answer, a status line, a one-off summary
that is not written anywhere) is **not** a named artifact and is out of scope.

The contract:

- **Reference a kind.** Point at the kind through the substitution form so the template owns the
  layout and the producer carries no duplicated format prose (see the template-authoritative
  model above).
- **Or justify the exception.** If the artifact genuinely has no template kind (and minting one
  is out of scope), add a `// REASON:` note in the body stating why. This keeps the gap honest
  and visible rather than silently baked-in.

### Enforcement

`scripts/validate/named-artifact-template.mjs` (`NAMED_ARTIFACT_TEMPLATE`) checks this rule. It
is currently **warn-only** — it surfaces producers that emit a named artifact without a template
reference or a `// REASON:` note, but does not fail the build. It graduates to **hard-fail** in a
later release, consistent with the usual warn → error convention recorded in
`AGENTS.md`.

Kinds flagged `designOnly: true` in `manifest/template-index.json` are **expected-orphan**: they
ship as design references with no near-term producer, so the validator does not warn that they
lack one. See `docs/templates.md` for the design-only roster.

## tool-param-permissions

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

## user-choice-discipline

# user-choice-discipline

> **Scope lane — WHERE/HOW (output location + format).** Fires at a skill's workflow fork: present location and format as two `AskUserQuestion` prompts; do not detect-and-assume either. Sibling (kept separate, do not merge): `decision-template-discipline` governs the **WHAT** dimension — the substantive option/approach choice rendered via the decision template, where it STOP-and-WAITs. This rule owns only the location-and-format fork; the decision-template WAIT-gate is independent (see the Note below).

## The rule

<HARD-GATE phase="workflow-fork">
When a skill generates an artifact and has a workflow fork (different output paths, different
formats, different destinations), the skill MUST present TWO independent `AskUserQuestion` prompts:

1. **Q1 — Where to store?** Options include `.aegis/<kind>/` (Recommended), `docs/<kind>/`,
   `~/.aegis/projects/<auto-name>/<kind>/` (if `~/.aegis/` exists), and a custom-path option.
2. **Q2 — What format?** Offer the formats the artifact's **kind actually ships** per
   `manifest/template-index.json` (`html` / `markdown` / `json`, in any combination the kind
   declares — including **HTML** where the kind ships it), with the kind's `default` format
   marked Recommended. Do not hardcode a fixed three-option set; read the kind's available
   formats from the index.

The skill MUST NOT detect whether `.aegis/` exists and silently pick location or format.
The skill MUST NOT couple location to format — they are independent dimensions.

The rule: **ask both questions, do not detect-and-assume either.**

This gate lifts ONLY when:
- Two `AskUserQuestion` payloads are rendered at the workflow fork (Q1 then Q2).
- Q1 includes ≥3 options, one of which references `.aegis/<kind>/` and is marked Recommended.
- Q2 offers the kind's index-declared formats (per `manifest/template-index.json`), including
  HTML where the kind ships it, with the kind's `default` format marked Recommended. (No fixed
  "exactly three options" contract — the option set is whatever formats the kind declares.)
- Both the user's location response AND format response drive the output — not file-system detection.
- Preferences are checked first (via the project's preference resolver, if one exists);
  if a stored preference exists, both questions may be skipped.
</HARD-GATE>

> **Note — decision gate is unaffected.** `decision-template-discipline`'s WAIT-gate (keyed to
> `${TEMPLATE:decisions}`) is independent of this format fork. Widening Q2 here does not touch
> that gate; the decision template is resolved by the decision gate, not by Q2's format choice.

## Why detect-and-assume breaks adoption

If a skill silently picks Aegis-flavored output only when `.aegis/` already exists, it creates a
chicken-and-egg problem: the directory never gets created on first use, so new projects never get
Aegis-flavored output, so they never benefit from Aegis tooling integration. The two-question
pattern breaks this cycle — the user can opt into Aegis structure on the first run, and the skill
creates the directory if it does not exist.

Coupling location to format creates a second failure: a user who wants `.aegis/reviews/` AND
markdown cannot express that in a single-question pattern. The cross-product of locations and
formats must be available — hence two independent questions.

## How to apply

Short form:

1. **Prompt override check.** Parse the user's prompt for explicit location hints
   (`/store (this )?(at|in|to) (\S+)/i`). If matched, extract the path and skip Q1.
2. **Preference check.** Call the project's preference resolver (if any) for the artifact kind.
   - Per-kind preference exists → skip both Qs; use stored location and format.
   - Default-only preference → use defaults; consider skipping.
   - No preference → ask both Qs.
3. **Q1 — location.** Construct a decision prompt with the `.aegis/<kind>/` option marked
   `recommended: true`. Include ≥3 options.
4. **Q2 — format.** Look the artifact's kind up in `manifest/template-index.json`; build a second
   decision prompt offering exactly the formats that kind ships (`formats` keys — `html` /
   `markdown` / `json`, including HTML where present), with the kind's `default` format marked
   Recommended. Surface via a second `AskUserQuestion`. The option set is index-driven, not fixed.
5. **Post-selection — runtime template resolution.** After both responses, for each chosen
   format: (1) read `${CLAUDE_PLUGIN_ROOT}/manifest/template-index.json`; (2) take
   `kinds[<kind>].formats[<chosen>]`; (3) `Read` that path under the plugin root (e.g.
   `${CLAUDE_PLUGIN_ROOT}/templates/html/<kind>.html`); (4) fill the `<!-- SLOT: … -->` (HTML) /
   `{{ slot.key }}` (markdown) markers with the artifact's content; (5) write `<name>.<ext>` at
   the chosen location (`markdown` → `.md`; `json` → `.json`; `html` → `.html`). If the user
   picks more than one format, repeat for each. This is a **runtime** procedure — `${TEMPLATE:…}`
   is a **build-time** projector directive (see `scripts/project.mjs`), never evaluated at
   runtime; do not attempt to "resolve" one during a skill run. On hosts without a plugin-root
   variable, the templates ship alongside the Aegis install — resolve relative to the install
   root instead (see the OpenCode gap noted in `adapters/opencode/projection.md`).
   - `.aegis/<kind>/` → bootstrap the directory silently (`mkdir -p`).
   - Custom path → validate (relative, no `..`, no cwd escape).
6. **Persist.** Record the chosen location and format as the per-kind preference.

## Kind taxonomy

Use canonical artifact-directory tokens when referencing artifact directories in skill prose.

| Artifact type | Token |
|---|---|
| plan | `${AEGIS_PLANS_DIR}` |
| spec | `${AEGIS_FEATURES_DIR}/<slug>/` |
| research | `${AEGIS_RESEARCH_DIR}` |
| decision | `${AEGIS_ROOT}/decisions/` |
| audit | `${AEGIS_AUDITS_DIR}` |
| review | `${AEGIS_ROOT}/reviews/` |
| ADR | `${AEGIS_ROOT}/adrs/` |

## Red flags (thoughts that mean STOP)

| Thought | Reality |
|---|---|
| "I'll check if `.aegis/` exists and pick automatically" | Detect-and-assume. Show the Q1 choice instead. |
| "The user probably wants Aegis format" | Probably is not agency. Ask. |
| "Location implies format — I only need one question" | They are independent. Ask both. |
| "The skill is simple — no fork needed" | If the output destination or format can vary, there is a fork. Show both questions. |
| "I'll add the prompts later" | Later means never. The fork is now; both prompts are now. |
| "I'll skip Q2 because the user picked .aegis/" | Format is independent of location. Ask Q2 regardless. |

## Reference

- Example: `rules/user-choice-example.md`

## user-choice-example

# user-choice-example

> **Non-invocable demo — not a shipping rule/skill.** This file is an E2E payload-shape fixture: it demonstrates the conformant Q1 (location) + Q2 (format) `AskUserQuestion` shapes that `user-choice-discipline` mandates. It is documentation-by-example, not an invocable surface. Do not route work to it; do not treat it as a rule that governs behaviour. The governing rule is `rules/user-choice-discipline.md`.

**Announce:** I'm using the user-choice-example skill to demonstrate the two-question pattern (location + format) for storing a code-review writeup.

## Status

Starting the two-question user-choice prompt.

## Q1 — Location choice

Where should the code-review writeup be stored? Location and format are independent choices.

I will present the first `AskUserQuestion` payload to the user now:

```json
{
  "question": "Where should the code-review writeup be stored?",
  "intro": "Storing under .aegis/reviews/ integrates with Aegis tooling (search, cross-linking, structured frontmatter). Storing under docs/reviews/ keeps the artifact in your repo's public docs. Out-of-project storage keeps your repo clean. A custom path gives you full control.",
  "options": [
    {
      "label": ".aegis/reviews/ (Recommended)",
      "description": "In-project Aegis tree; created if missing. Integrates with Aegis tooling — search, cross-linking, structured frontmatter."
    },
    {
      "label": "docs/reviews/",
      "description": "In-project public-shaped docs. Use when you want the artifact in your repo's published docs."
    },
    {
      "label": "~/.aegis/projects/<auto-name>/reviews/",
      "description": "Out-of-project; keeps your project repo clean of generated artifacts. Only shown when ~/.aegis/ exists."
    },
    {
      "label": "Other (custom path)",
      "description": "Provide a relative path. Must not contain \"..\" or escape the project root."
    }
  ],
  "_rationale": "Picks up structured frontmatter and Aegis cross-linking; the directory is bootstrapped on first use."
}
```

## Q2 — Format choice

What format should the code-review writeup use? Format is independent of location.

The option set is **index-driven**: the `code-review` kind declares `formats: { markdown, html }` in
`manifest/template-index.json` with `default: markdown`, so Q2 offers exactly Markdown and HTML —
including the HTML stakeholder deliverable — with Markdown (the default) marked Recommended. A kind
that also shipped JSON would surface a JSON option here too; a kind that shipped only HTML would
surface HTML alone.

I will present the second `AskUserQuestion` payload to the user now:

```json
{
  "question": "What format should the code-review writeup use?",
  "intro": "Choose based on who will read the artifact. The options below are the formats the code-review kind ships per manifest/template-index.json. Format is independent of where the file is stored.",
  "options": [
    {
      "label": "Markdown (Recommended)",
      "description": "Human-readable narrative; renders in PR diffs and on GitHub. The code-review kind's default format."
    },
    {
      "label": "HTML",
      "description": "Standalone stakeholder deliverable — severity-graded findings and reviewer sign-off as a self-contained page. Best when sharing outside the diff."
    }
  ],
  "_rationale": "Markdown is the default and serves PR/GitHub readers; HTML produces a shareable standalone artifact. Both come straight from the kind's index entry — no hardcoded format list."
}
```

After the user selects location and format:
- `.aegis/reviews/` → `mkdir -p`; load Aegis-flavored output addendum if present.
- `docs/reviews/` or custom path → use generic skill body verbatim; validate path (relative, no `..`, no cwd escape).
- Resolve the chosen format via `${TEMPLATE:code-review:<format>}` and write it: Markdown → `<name>.md` (from `${TEMPLATE:code-review:markdown}`); HTML → `<name>.html` (from `${TEMPLATE:code-review:html}`). If more than one format is chosen, write one file per format.

## Done — status: DONE

## verification-before-completion

# verification-before-completion

> **Scope lane — completion gates.** Fires before you claim a task done/fixed/passing: run the tests/build/lint and paste the output. Siblings (kept separate, do not merge): `evidence-before-assertion` governs every prose *claim* (cite file:line / command output); `rationalization-prevention` governs every *skip/downgrade/defer* decision (name the urge, don't act on it). This rule owns the "is it actually done?" gate only.

## The rule

<HARD-GATE phase="completion">
Before you say a task is done, fixed, or passing, run the command that proves it and paste the output verbatim. No silent claims. No "should work." No "I'm confident it's fine." Evidence, not assertion.

letter = spirit: the intent of this gate is that the verification command runs *now*, against the *current* tree, with output the user can scrutinize. Running an older invocation, citing a prior session's output, or summarizing the result without a verbatim paste satisfies the letter (some command was run) but violates the spirit (the user cannot independently verify the claim). The output must be fresh and pasted whole.

This gate lifts ONLY when:
- The verification command is named explicitly (`npm test`, `tsc --noEmit`, etc.).
- The command was just run against the current working tree.
- The verbatim output (not a summary) appears in the response or a quoted block.
</HARD-GATE>

## When to use

- About to mark any task complete.
- About to claim a fix worked, a test is passing, or a feature is implemented.
- Composing an end-of-turn summary with phrases like "done," "fixed," or "ready."

## Red flags (thoughts that mean STOP)

| Thought | Reality |
|---|---|
| "It should work" | Should-work is a prediction, not evidence. Run it. |
| "I already checked that path earlier" | State changes. Re-check. |
| "The diff is small, the test will pass" | Prove it by running the test. |
| "I'll run the whole suite later" | Later ≠ now. Run the scoped test right now. |
| "It built — it's fine" | Build ≠ behavior. Run it. |
| "I verified it in my head" | Heads don't run code. |

## Exit condition

A concrete, testable success marker: command output, test-runner summary, commit hash, file diff, or screenshot. "It works" is not an exit condition.

## QA evidence

When you report completion, state four things in one compact block: WHAT you tested, WHAT you
observed, WHY that's sufficient, and WHAT was deliberately omitted or deferred. This is the
completion gate's evidence in artifact form — pairs with `evidence-before-assertion`'s per-claim
citation rule, but scoped to the single completion report rather than every sentence.

Example: "Tested: `npm test -- auth.spec.ts`. Observed: 12/12 pass, 0 skipped. Sufficient:
covers the new token-refresh branch end to end. Omitted: did not re-run the full E2E suite
(unrelated to this change)."

## Why

Unverified claims compound into real bugs and lost trust. The cheapest moment to catch a defect is before you stamp "done." Every shipped defect that could have been caught by a pre-claim run makes this rule cheaper retroactively.

