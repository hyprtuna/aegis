---
name: aegis-sdd-workflow
description: 'Use when starting a new feature from scratch and no approved spec exists yet.'
---

## Status
sdd-workflow starting — spec-driven development cycle; drafting spec before any planning or implementation begins

# SDD Worker

Strict spec-driven development. Every implementation plan exists because an approved spec demanded it.

## When to Use

- A new feature or significant change is requested and no approved spec exists yet.
- You need the design gate (spec → plan → implement) before any code is written.

For the full per-phase mechanics (each phase's required outputs, the SDD-vs-TDD relationship,
the red-flags and checklist tables), see `abilities/cycle-detail.md`. This body carries the gate,
the decision forks, and the workflow summary.

---

## The SDD Gate

<HARD-GATE phase="idea→spec">
DO NOT write implementation files, create plan files, or invoke implementation-planner until the
user has reviewed and explicitly approved the spec produced by brainstorm-spec.

The intent of this gate is that no planning or implementation work begins before
the spec's assumptions, decisions, and acceptance criteria are agreed upon.

This gate lifts ONLY when the user responds with explicit confirmation:
"approved", "looks good, proceed to plan", "go ahead", or equivalent.
A vague acknowledgment ("ok", "sure", "yes") is not approval.

Gate checklist before exiting:
- [ ] brainstorm-spec has produced a spec with all required sections
- [ ] ## Open Questions section is present (even if empty: "- (none)")
- [ ] User has given explicit approval before implementation-planner is invoked
</HARD-GATE>

---

## Decision Forks

- **No spec yet?** → SPEC phase: invoke `brainstorm-spec`, then gate on approval.
- **Spec approved?** → PLAN phase: invoke `implementation-planner`; verify every AC maps to a task.
- **Plan verified?** → IMPLEMENT phase under `test-driven-development`.
- **Increment built?** → REVIEW phase: route through `two-stage-review` (any FAIL loops back to IMPLEMENT).
- **Both review stages pass?** → COMMIT the phase, then repeat from SPEC for the next feature.
- **Implementation diverges from spec?** → stop; either update the spec (with approval) or bring code back in line.

Each phase's required outputs and gate mechanics live in `abilities/cycle-detail.md`.

---

## Workflow Summary

```
1. Receive the feature goal.
2. Invoke brainstorm-spec.              [SPEC]
3. Present spec; await approval.        [GATE]
4. Invoke implementation-planner.       [PLAN]
5. Review plan for AC coverage.         [VERIFY PLAN]
6. Execute plan under TDD discipline.   [IMPLEMENT]
7. Route through two-stage-review.      [REVIEW]  ── any FAIL loops back to step 6
8. Commit each verified phase.          [COMMIT]
9. Repeat from 2 for the next feature.
```

The chain is gated: `brainstorm-spec` (handoff: the approved spec) → `implementation-planner`
(handoff: the verified plan) → IMPLEMENT → `two-stage-review` (forward on a both-pass, **back to
IMPLEMENT** on any fail) → COMMIT. The entry transition is declared via `x-aegis.pipeline.next`
(→ `brainstorm-spec`); see `docs/workflow-guide.md` → *The phase-ordered gated-workflow convention*.

---

## Done
sdd-workflow done — spec → plan → implement cycle complete; all phases verified; status: DONE
