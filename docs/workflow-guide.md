# Workflow Guide

How Aegis capabilities compose — and the decision rule for choosing the right surface when you
add one. This guide is the canonical home for the **SKILL vs COMMAND** taxonomy, the
phase-ordered gated-workflow convention, and the review-cluster hierarchy.

## The shape of the tree

Aegis ships a **spine of 20 skills in a single bucket, `skills/core/`**. Everything else that used
to be its own skill is now an **ability fragment** — an unregistered `.md` file under a parent
skill's `abilities/` directory, loaded on demand when the work reaches it.

That is the whole structure. There is no `skills/workflows/` bucket and no `skills/languages/`
bucket; both were dissolved into `core/`, and their contents survive as fragments of the spine
skill that owns the work. The reason is bluntly practical: every registered skill costs the user
harness room and adds one more near-identical name for the model to choose between. Content that
is *reference material for a phase* does not need to be independently discoverable — it needs to be
reachable from the skill that governs the phase.

**Consequence for authors:** the interesting question is no longer "which bucket?" but "does this
deserve to be one of the 20, or is it a fragment of one of them?" Default to fragment.

## The two surfaces

| Surface | What it is | Auto-exposes? | When to reach for it |
|---|---|---|---|
| **SKILL** | An independently discoverable, reusable capability. One of the 20 in `skills/core/`. | Yes — as `/<skill-name>` on supporting hosts. | The default for a capability that stands on its own and is genuinely useful in isolation. |
| **COMMAND** | A slash-command entry-point that **composes or sequences multiple skills**, or is a meta-utility. Hard cap **~15**. | It *is* the slash command. | Only when a single skill does not cover it — the entry point genuinely orchestrates more than one skill, or it is a utility (e.g. `pr`) with no skill of its own. |

A **workflow** is not a third surface. It is a *shape* a skill can take: a multi-phase, gated chain
whose phases are documented in the body. `default-feature`, `debugging`, `codebase-onboarding`, and
`security-auditing` are skills of that shape, and they live in `skills/core/` alongside every other
skill.

### Canonical examples

- **`code-review` = SKILL.** It performs one well-scoped job (emit severity-graded findings) and is useful on its own. Auto-exposes as `/code-review`.
- **`pr` = COMMAND.** A meta-utility entry point with no standalone skill; it composes git/GitHub steps. One of the 6 surviving meta-utility commands.
- **`default-feature` = SKILL of workflow shape.** A multi-phase chain (`brainstorm-spec → implementation-planner → implement → review → respond`) where each phase gates on the prior.
- **`two-stage` = FRAGMENT.** Sequencing spec-compliance then code-quality review is reference material for the review phase, not a separate capability, so it is `skills/core/code-review/abilities/two-stage.md` — reachable from `code-review`, not registered on its own.

### The decision rule

1. Is this reference material or procedure for a phase of an existing skill? → **FRAGMENT** (`abilities/<name>.md` under that skill). Start here; most content lands here.
2. Does the capability stand on its own, do one job, and warrant its own name in the user's slash menu? → **SKILL** in `skills/core/` (it auto-exposes; you need nothing else).
3. Is it an entry point that composes/sequences *multiple* skills, or a utility with no skill of its own? → **COMMAND** (and only if a skill can't express it — the command budget is ~15).

A skill is **not** promoted to a command just to "have a slash command" — skills already auto-expose
as `/<skill-name>`. Adding a single-skill wrapper command is forbidden (see `AGENTS.md` §commands);
an earlier cleanup pass deleted eight such wrappers.

## Chaining is prose, and only prose

**Nothing routes automatically.** Aegis has no runtime: no hook, no scheduler, and no frontmatter
field transitions one skill to the next. When a skill hands off, it does so because its **body says
so** and the model reads it and acts. The projector emits no `x-aegis` key to any host, so a
chain declared only in frontmatter is a chain that never runs.

Write transitions with one of two explicit markers, borrowed from the reference corpus:

```markdown
## REQUIRED SUB-SKILL: implementation-planner

After the user approves the spec, the next step is `aegis:implementation-planner`. …
```

```markdown
**REQUIRED SUB-SKILL:** use `aegis:test-driven-development` to write that test. …

**REQUIRED BACKGROUND:** this skill consumes review findings, so it presupposes a
completed review — normally `aegis:code-review`. …
```

- **REQUIRED SUB-SKILL** = a *transition*. Finish here, go there next.
- **REQUIRED BACKGROUND** = a *prerequisite*. You must understand that skill first; it is not a
  forward step, so naming an upstream skill this way is correct and is not a loop.

Do **not** force-load a successor with an `@`-style directive — that spends context on a skill you
may not reach. Name it and let the model invoke it.

**What is checked.** The `COMPOSITION` validator parses these markers out of skill bodies, checks
that every named skill actually exists under its current name, and checks that the SUB-SKILL graph
is acyclic. It reads the prose because the prose is the mechanism — a check against frontmatter
would be green about something no host can see. **It is warn-only:** a stale edge does not fail the
build, so read the warnings.

### The shipped spine

The main delivery chain, as written in the bodies:

```
default-feature → brainstorm-spec → implementation-planner → orchestrate → code-review
                                                                  ↓             ↓
                                                            verification ← review-response
                                                                  ↓
                                                          finishing-branch
```

`debugging` chains into `test-driven-development` for its Phase 4 failing test. `review-response`
names `code-review` as REQUIRED BACKGROUND. `codebase-onboarding` and `security-auditing` are
self-contained — their phases are internal and they hand off to no separate named skill.

## The phase-ordered gated-workflow convention

A skill of workflow shape is not a loose bag of phases — it is a **phase-ordered, gated chain**.
Three rules:

1. **Each phase gates on the prior.** A phase may not start until its predecessor has produced its
   **hand-off artifact**. The artifact *is* the gate: no artifact, no advance. (A design memo, an
   approved spec, a committed plan file, a `SPEC_PASS`/`QUALITY_PASS` signal — each is the concrete
   evidence the previous phase actually finished.)
2. **The transition names its successor.** When a phase completes, the skill hands off to a
   *specific, named* successor — never an implicit "and then we review somehow". Write it as a
   REQUIRED SUB-SKILL marker in the body, per the section above.
3. **A failing gate routes deliberately — forward on pass, back on fail.** A gate that fails does not
   silently advance; it loops back to the phase that can fix the failure (e.g. a code-quality fail
   loops back to implementation, not forward to "respond"). Forward motion is earned, not assumed.

**Source pattern.** This mirrors the gated-workflow shape from the superpowers / get-shit-done
agentic-workflow corpus: explicit phase order, an artifact handed between phases, and a named next
step the transition invokes — rather than a monolithic prompt that hopes the model self-sequences.

A workflow whose phases are all internal (no hand-off to a *separate named skill*) documents its
phase order in prose and simply carries no SUB-SKILL marker. That is a complete, valid skill, not an
omission.

> **Authoring rule.** Every name in a REQUIRED SUB-SKILL / REQUIRED BACKGROUND marker MUST be a real
> current skill. If `COMPOSITION` warns, you named something that does not exist under that name —
> fix the edge, do not invent a phase-label alias. A body that sends the model after a skill which no
> longer registers is a dead end for the user.

## The review cluster: instrument vs consumers

The review surfaces form an instrument/consumer hierarchy:

- **`code-review` is the instrument.** It performs a review and emits findings. The paired
  `code-reviewer` agent (with `--type` and `--strict` modes) is the doer; the skill is the inline
  entry point.
- **`review-response` is the workflow that consumes those findings.** It verifies each one before
  implementing and pushes back on the ones that are wrong. It does not re-implement reviewing.
- **Assembling context and sequencing passes are fragments of `code-review`**, not separate skills:
  `abilities/requesting.md` (dispatching a reviewer on a change) and `abilities/two-stage.md`
  (spec-compliance then code-quality as two gated passes).

When you need to change *how a review is performed*, change `code-review`. When you need to change
*how findings are handled*, change `review-response`.

## Why Aegis exports skills, not workflow templates

Aegis ships **reusable capability skills**, not packaged orchestration templates. Users (and agents)
compose behaviour by:

- **Sequencing skills** — invoke `brainstorm-spec`, then `implementation-planner`, then implement,
  then `code-review`. Each is independently useful and independently improvable.
- **Fanning out via `orchestrate`** — for independent subtasks, dispatch a wave of subagents
  (≤5 per wave) and synthesize. That is the orchestration primitive, and it is a skill, not a
  shipped template.

Why not ship workflow *templates* (frozen multi-step scripts)? Because a template freezes a
composition that real work rarely matches, and it rots: when one step's skill improves, every
template embedding it drifts. Exporting skills keeps each capability the single source of truth and
lets composition stay fluid — a workflow-shaped skill documents a *recommended* phase order and its
gates, but it invokes the underlying skills rather than inlining frozen copies of them.

## See also

- `AGENTS.md` — the `agents/` and `commands/` surface conventions (including the ~15-command cap and the single-skill-wrapper prohibition).
- `skills/AGENTS.md` — skill layout and the abilities model.
- `docs/architecture.md` — the overall surface tree.
