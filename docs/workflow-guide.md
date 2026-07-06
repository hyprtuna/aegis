# Workflow Guide

How Aegis capabilities compose — and the decision rule for choosing the right surface
when you add one. This guide is the canonical home for the **SKILL vs COMMAND vs WORKFLOW**
taxonomy (audit §2/§4) and the review-cluster hierarchy.

## The three surfaces

| Surface | What it is | Auto-exposes? | When to reach for it |
|---|---|---|---|
| **SKILL** | An independently discoverable, reusable capability. | Yes — as `/<skill-name>` on supporting hosts. | The default. A capability that stands on its own and is useful in isolation. |
| **COMMAND** | A slash-command entry-point that **composes or sequences multiple skills**, or is a meta-utility. Hard cap **~15**. | It *is* the slash command. | Only when a single skill does not cover it — i.e. the entry point genuinely orchestrates more than one skill, or it is a utility (e.g. `pr`) with no skill of its own. |
| **WORKFLOW** | A multi-phase, gated chain expressed as a skill folder under `skills/workflows/`. Each phase gates on the prior; the transition hands off a named artifact. | Yes — the parent `SKILL.md` auto-exposes; phase fragments are unregistered `abilities/`. | A capability that is inherently a sequence of phases with hand-off artifacts (brainstorm → plan → implement → review). |

### Canonical examples

- **`code-review` = SKILL.** It performs one well-scoped job (emit severity-graded findings) and is useful on its own. Auto-exposes as `/code-review`.
- **`pr` = COMMAND.** A meta-utility entry point with no standalone skill; it composes git/GitHub steps. One of the 6 surviving meta-utility commands.
- **`default-feature` = WORKFLOW.** A multi-phase chain (`design-exploration → implementation-planner → implement → review → respond`) living under `skills/workflows/`, with each phase gating on the prior.

### The decision rule

1. Does the capability stand on its own and do one job? → **SKILL** (it auto-exposes; you need nothing else).
2. Is it a multi-phase, gated sequence with hand-off artifacts between phases? → **WORKFLOW** (a skill folder under `skills/workflows/`).
3. Is it an entry point that composes/sequences *multiple* skills, or a utility with no skill of its own? → **COMMAND** (and only if a skill can't express it — the command budget is ~15).

A skill is **not** promoted to a command just to "have a slash command" — skills already auto-expose as `/<skill-name>`. Adding a single-skill wrapper command is forbidden (see `AGENTS.md` §commands); v0.0.10 deleted eight such wrappers.

## The phase-ordered gated-workflow convention

A workflow under `skills/workflows/` is not a loose bag of phases — it is a **phase-ordered, gated
chain**. The convention has three rules:

1. **Each phase gates on the prior.** A phase may not start until its predecessor has produced its
   **hand-off artifact**. The artifact *is* the gate: no artifact, no advance. (A "design memo", an
   approved spec, a committed plan file, a `SPEC_PASS`/`QUALITY_PASS` signal — each is the concrete
   evidence the previous phase actually finished.)
2. **The transition invokes a named `next` skill.** When a phase completes, the workflow hands off
   to a *specific, named* successor skill — never an implicit "and then we review somehow". On skills
   that carry composition metadata this is declared in frontmatter as `x-aegis.pipeline.next` (see
   `skills/AGENTS.md` → *Composition metadata*); in every workflow body the phase order and its
   hand-off artifacts are documented in prose so the chain is legible without reading frontmatter.
3. **A failing gate routes deliberately — forward on pass, back on fail.** A gate that fails does not
   silently advance; it loops back to the phase that can fix the failure (e.g. a code-quality fail
   loops back to implementation, not forward to "respond"). Forward motion is earned, not assumed.

**Source pattern.** This mirrors the gated-workflow shape from the superpowers / get-shit-done
agentic-workflow corpus: explicit phase order, an artifact handed between phases, and a named next
step the transition invokes — rather than a monolithic prompt that hopes the model self-sequences.

**How it is expressed.** The convention is a *documented convention applied to existing workflows*,
not a new taxonomy tier (taxonomy stays `core / languages / workflows`). It is enforced through the
Phase-A composition metadata (`x-aegis.pipeline.{requires,handoff,next}`), which the `COMPOSITION`
validator checks for acyclicity and real-skill / real-template-kind references. A workflow that
genuinely composes other **named** skills carries an `x-aegis.pipeline` block; a workflow that is a
single self-contained sequence of internal phases (no hand-off to a *separate named skill*) documents
its phase order in prose alone and carries no block (it is atomic at the composition layer).

> **Authoring rule.** Every value you put in `requires` / `next` MUST name a real current skill, and
> every `handoff` MUST name a real template kind (or carry a `// REASON:` note). If `COMPOSITION`
> warns, you named a skill that does not exist under its current name — fix the edge, do not invent a
> phase-label alias.

## The review cluster: instrument vs workflows

The review surfaces form an instrument/workflow hierarchy (no renames — documented relationship):

- **`code-review` is the instrument.** It performs a review and emits findings. The paired `code-reviewer` agent (with `--type` and `--strict` modes) is the doer; the skill is the inline entry point.
- **`review-requesting`, `review-response`, `two-stage-review` are workflows that *call* `code-review`.** They assemble context, consume findings, or sequence reviewing across passes — they do **not** re-implement reviewing. When you need to change *how a review is performed*, change `code-review`; when you need to change *how reviewing is orchestrated*, change the workflow.

## Why Aegis exports skills, not workflow templates

Aegis ships **reusable capability skills**, not packaged orchestration templates. Users (and agents) compose behaviour by:

- **Sequencing skills** — invoke `design-exploration`, then `implementation-planner`, then implement, then `code-review`. Each is independently useful and independently improvable.
- **Fanning out via `parallel-wave-executor`** — for independent subtasks, dispatch a wave of subagents (≤5 per wave) and synthesize. This is the orchestration primitive; it is a skill, not a shipped template.

Why not ship workflow *templates* (frozen multi-step scripts)? Because a template freezes a composition that real work rarely matches, and it rots: when one step's skill improves, every template embedding it drifts. Exporting skills keeps each capability the single source of truth and lets composition stay fluid — the workflow skills under `skills/workflows/` document a *recommended* phase order and its gates, but they invoke the underlying skills rather than inlining frozen copies of them.

## See also

- `AGENTS.md` — the `agents/` and `commands/` surface conventions (including the ~15-command cap and the single-skill-wrapper prohibition).
- `skills/AGENTS.md` — skill layout (`core` / `languages` / `workflows`) and the abilities model.
- `docs/architecture.md` — the overall surface tree.
