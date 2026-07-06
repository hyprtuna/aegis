# Authoring Doctrine

A skill exists to wrangle determinism out of a stochastic system — **predictability** (the same
process every run) is the root virtue the levers below serve.

## Leading words

A leading word is a compact concept already in the model's pretraining that the agent thinks with
while running the skill. It anchors a region of behaviour in the fewest tokens, and it pays off
twice: once in the body (shapes execution) and once in the description (shapes invocation/discovery).
Hunt restated triads for a single word that already carries the meaning — "fast, deterministic,
low-overhead" collapses to *tight*. A strong leading word retires the triad it replaces; if you still
need the triad after naming the word, the word was wrong.

## Completion criteria

Each `## Process` step should end on a *checkable* condition — can the agent tell done from
not-done? Where it matters, make the criterion *exhaustive* ("every modified model accounted for",
not "produce a change list"). A vague criterion invites premature completion (see below). This is
the same discipline SKILL.md's Body Structure section names for `## Process` steps; the full
definition lives here so it is stated once.

## Progressive-disclosure ladder

Three rungs, ranked by how immediately the agent needs the material:

1. **In-skill step** — an ordered action written directly in `SKILL.md`.
2. **In-skill reference** — a definition, rule, or fact consulted on demand, still inside the skill.
3. **External reference** — pushed out of `SKILL.md` into a linked file, reached by a **context
   pointer**, and loaded only when the pointer fires.

**Progressive disclosure** is the move down this ladder so the top rung (`SKILL.md`) stays legible.
**Co-location** means keeping a concept's definition, rules, and caveats under one heading rather
than scattering them.

Aegis mapping: rung 3 is `abilities/<x>.md`, `REFERENCE.md`, or `EXAMPLES.md` (see `skills/AGENTS.md`
for the tiered layout this implies). The pointer's *wording* — not its target — decides how reliably
the agent actually follows it; write the pointer as a concrete trigger ("read X when doing Y"), not a
vague "see also."

## Failure modes

- **Premature completion** — ending a step before it is genuinely done. Defence: sharpen the
  completion criterion first; only split the step to hide post-completion work if sharpening alone
  doesn't fix it.
- **Sediment** — stale layers that settle because adding feels safe and removing feels risky. This is
  the default fate of any skill without a pruning discipline; periodically re-read the whole body and
  cut lines that no longer earn their place.
- **No-op** — a line the model already obeys by default, so you pay context load to say nothing.
  Test: does the line change behaviour versus the no-guidance default? If not, delete it.
- **Duplication** (supporting) — the same fact stated in two places drifts when only one copy gets
  updated.
- **Sprawl** (supporting) — a skill accretes unrelated concerns until it no longer has one job.

## Generated facts, guarded against drift

Facts that exist in source — tool names and parameters, host paths, endpoints, env vars, hook
events, version stamps — are generated, never hand-typed. In Aegis, `scripts/project.mjs` and the
manifest are that source: hand-editing a generated host file or version stamp is forbidden (root
`AGENTS.md` Iron Law 2). This is already enforced mechanically; naming it here is authoring guidance
so a skill body never re-introduces a fact that projection would otherwise keep correct.
