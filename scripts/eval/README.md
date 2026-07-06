# Aegis Eval Harness (Skeleton — v0.0.6)

This directory is a **scaffold only**. In v0.0.6 it ships the directory layout, a
no-op baseline runner, and an empty fixtures folder. There are **no API calls, no
network access, and no cost** in this release. Running the baseline runner prints a
single marker line and exits 0:

```bash
node scripts/eval/three-arm-baseline.mjs
# → eval harness skeleton — no API calls in v0.0.6
```

## Layout

```
scripts/eval/
├── three-arm-baseline.mjs   # no-op runner (skeleton)
├── fixtures/                # eval inputs (empty seed; .gitkeep only)
└── README.md                # this file
```

## The deferred three-tier framework

When the framework is implemented (v0.1.x+), it evaluates Aegis surfaces across
three arms run over the fixtures in `fixtures/`:

1. **Static lint arm.** Deterministic, dependency-free checks — frontmatter
   conformance, structural shape, prose denylist (`scripts/validate-prose.mjs`),
   count drift (`scripts/validate-counts.mjs`). No model, no key, no cost. This arm
   can land first because it reuses existing validators.
2. **LLM Judge arm.** A model scores surface outputs against a rubric (does this
   skill fire on the right trigger? does the agent stay in its tool budget? is the
   output well-formed?). Requires API key handling and a per-run cost budget.
3. **Monte Carlo arm.** Repeated sampled runs of the same fixture to measure
   output variance and catch regressions that a single deterministic run hides.
   The most expensive arm — highest sampling cost.

## Why skeleton-only in v0.0.6

Per `.aegis/plans/v0.0.6-plan.md` ("Locked Decisions" and "Honest Gaps"), the eval
harness is maintainer-only and the full framework is deferred because:

- **No user API keys.** Aegis is plugin-first; users never run these scripts, and
  the project does not assume any user-provided model credentials.
- **Cost discipline.** Arms 2 and 3 spend tokens per run. A CI cost budget must be
  approved before they can run automatically.
- **CI integration deferred.** Gating PRs on eval results requires the budget above
  plus result storage and a flake policy — out of scope until v0.1.x+.

## References

The three-arm design is derived from the reference-plugin research:

- `.aegis/research/wshobson-agents.research.md`
- `.aegis/research/caveman.research.md`
- `.aegis/research/impeccable.research.md`
