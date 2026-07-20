# Aegis Eval Harness

The **static lint arm** is live as of v0.1.2. It loads every fixture
under `fixtures/*.json` and asserts (a) required fields are present and (b)
each `expectRoutesTo` path resolves to a real skill folder (a directory
carrying `SKILL.md`) in the repo. No API calls, no network access, no cost.

**Manual-run only — not wired into `gate.mjs` or CI.** `scripts/gate.mjs` (the
single entry point CI runs) does not invoke this harness; it catches a routing
regression only when a maintainer runs it by hand (or as part of the
per-ticket static gate documented in the release workflow). Gating it into
`gate.mjs` so it runs automatically on every push is a possible v0.1.3
follow-up, not something this release does.

```bash
node scripts/eval/three-arm-baseline.mjs
# → PASS  react-todo-brainstorm (react-todo-brainstorm.json)
# →
# → # static-lint arm: 1 passed, 0 failed (of 1)
```

Exits non-zero if any fixture fails — a renamed or removed routed-to skill
(e.g. `default-feature` or `brainstorm-spec`) fails the harness the next time
someone runs it, instead of drifting silently forever. Since it is not wired
into `gate.mjs`/CI (see above), "the next time someone runs it" is the honest
bound — it is not a per-push guarantee.

## Layout

```
scripts/eval/
├── three-arm-baseline.mjs   # static-lint arm runner (live)
├── fixtures/                # eval inputs — one *.json per acceptance case
└── README.md                # this file
```

## Fixture shape

```json
{
  "id": "react-todo-brainstorm",
  "prompt": "Let's build a react todo list",
  "expectRoutesTo": ["skills/core/brainstorm-spec", "skills/core/default-feature"],
  "criterion": "a workflow/process skill fires before any implementation code is written",
  "guardsFor": "bootstrap-forcefulness (the forceful SessionStart gate)"
}
```

- `id` — unique fixture identifier.
- `prompt` — the example user prompt the fixture models.
- `expectRoutesTo` — one or more canonical skill paths the prompt should route
  to; the static-lint arm asserts each one exists (regression guard against
  renames).
- `criterion` — the human-readable pass/fail condition for the *behavioral*
  claim (see "Acceptance test" below — the static-lint arm only checks the
  paths resolve, not that a live session actually routes there).
- `guardsFor` — which feature/decision this fixture is a regression guard for.

## Acceptance test (bootstrap forcefulness)

This is the **documented manual procedure** that exercises the claim the
`react-todo-brainstorm` fixture encodes — that the forceful SessionStart gate
folded into `skills/core/using-aegis/SKILL.md` actually changes
session behavior, not just static structure.

**Procedure:**

1. Start a fresh session on a host with Aegis loaded (bootstrap payload
   includes the `using-aegis` skill body).
2. Send the exact prompt: `Let's build a react todo list`.
3. Observe which skill (if any) the session invokes before writing any
   implementation code.

**Pass criterion:** a workflow/process skill — `brainstorm-spec` and/or
`default-feature` — fires before any implementation code is written. This
matches the fixture's `criterion` field above.

**Fail criterion:** the session starts writing React component code (or asks
only a narrow clarifying question) without invoking either skill first.

**Why this is the regression guard for the bootstrap-forcefulness gate.** The forceful gate
is prose injected into a session's bootstrap payload — there is no
deterministic static check that a model actually obeys prose. This manual
procedure is the intentional, honest substitute: run it once per release
touching `using-aegis/SKILL.md` or the gate's wording, and compare the result
against the **Validation Evidence** byte-delta baseline recorded for Phase A
(baseline stripped body 3539 B → injected block +1322 B measured (≈1.29 KB) →
4861 B after; budget ceiling < 1.5 KB additive; see
`.aegis/specs/features/ag-0008-superpowers/implementation-plan.md` §6 and
`decisions.md`). If the gate's wording changes enough to move the byte delta
outside the documented budget, re-run this procedure before shipping.

## Deferred arms

Two arms of the eventual three-tier framework remain deferred past v0.1.2:

1. **LLM Judge arm.** A model scores surface outputs against a rubric (does
   this skill fire on the right trigger? does the agent stay in its tool
   budget? is the output well-formed?). Requires API key handling and a
   per-run cost budget.
2. **Monte Carlo arm.** Repeated sampled runs of the same fixture to measure
   output variance and catch regressions that a single deterministic run
   hides. The most expensive arm — highest sampling cost.

Per the private planning repo's "Locked Decisions" and "Honest Gaps" notes, these
stay deferred because:

- **No user API keys.** Aegis is plugin-first; users never run these scripts,
  and the project does not assume any user-provided model credentials.
- **Cost discipline.** Both arms spend tokens per run. A CI cost budget must be
  approved before they can run automatically.
- **CI integration deferred.** Gating PRs on eval results requires the budget
  above plus result storage and a flake policy — out of scope until a later
  release.

## References

The three-arm design is derived from the reference-plugin research:

- `.aegis/research/wshobson-agents.research.md`
- `.aegis/research/caveman.research.md`
- `.aegis/research/impeccable.research.md`
