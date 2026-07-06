# SDD Cycle — Phase Detail

On-demand reference for the full SPEC → PLAN → IMPLEMENT → REVIEW → COMMIT cycle. The parent
`SKILL.md` carries the gate, the decision forks, and the workflow summary; this fragment carries
the per-phase mechanics.

## The SPEC → PLAN → IMPLEMENT Cycle

Every feature follows this pipeline. In order. No skipping.

### SPEC Phase: Draft the Spec

Invoke `brainstorm-spec` to transform the under-specified goal into a rigorous spec.

The spec produced must contain:
- **Goal** — what the feature accomplishes in one sentence
- **Context** — why this is needed now
- **Assumptions** — what is assumed true; each must be falsifiable
- **Decisions block** — explicit decisions locked before planning
- **Acceptance Criteria** — observable, testable outcomes
- **Open Questions** — unresolved matters (even if empty)
- **Out of Scope** — what is explicitly excluded

The brainstorm-spec skill handles the full spec-writing process. Your role here is
to pass the user's goal and any context to it, then gate on approval.

### VERIFY SPEC (Mandatory)

After brainstorm-spec completes:

1. **Present the spec to the user.**
2. **Solicit explicit approval.** Do not proceed to planning without it.
3. **If questions are raised:** loop back to brainstorm-spec with the feedback.
4. **Only after approval:** proceed to the PLAN phase.

### PLAN Phase: Write the Implementation Plan

Once the spec is approved, invoke `implementation-planner` to produce a phase-ordered
implementation plan.

The plan must contain:
- MustHaves frontmatter linking back to the spec
- Ordered phases, each independently verifiable
- Verification gates at each phase boundary
- A clear exit criterion for the entire plan

### VERIFY PLAN (Mandatory)

Before any implementation begins:

1. **Review the plan structure** — are phases ordered logically?
2. **Verify acceptance criteria coverage** — does every AC in the spec map to at least one plan task?
3. **Check for implicit assumptions** — does the plan assume anything not stated in the spec?
4. **If concerns exist:** raise them before proceeding. Fix the plan, not the code.

### IMPLEMENT Phase: Execute Under Discipline

With an approved spec and verified plan, implementation begins under the existing
skills chain — `test-driven-development` for the code, then the two-stage review loop below.

The spec is the authority. When implementation diverges from spec:
- Stop and decide: is the divergence intentional?
- If yes: update the spec and get approval before continuing.
- If no: bring implementation back in line with the spec.

The plan is the schedule. When a phase cannot be completed as written:
- Do not skip phases silently.
- Record the blocker and surface it.

### REVIEW Phase: Two-Stage Review Loop (gated, fail-loops-back)

After implementation produces a verified, tested increment, transition to the `two-stage-review`
skill — do **not** run a single inline review. `two-stage-review` orchestrates the `code-review`
instrument across two gated passes:

1. **Stage 1 — spec compliance.** Does the implementation match the approved spec's acceptance
   criteria — every required item present, nothing extra, interfaces correct? A `SPEC_FAIL`
   **loops back to IMPLEMENT** with the specific missing/extra/incorrect list; it does not advance
   to Stage 2.
2. **Stage 2 — code quality.** Is the change production-quality (correctness, architecture, security,
   performance, test quality, conventions)? A `QUALITY_FAIL` **loops back to IMPLEMENT** (the
   fix phase) with the findings — it does **not** advance forward to COMMIT.

Only when **both** stages pass does the phase advance to COMMIT. Both stages run over the
consolidated `code-reviewer` agent (the `code-review` instrument) via `two-stage-review`; the
internal spec-compliance and code-quality reviewers are dispatch targets inside `two-stage-review`,
not public agents invoked here. A failing gate always routes **back** to IMPLEMENT, never forward.
This honors SDD's authority rule: a spec-compliance fail means the code drifted from the approved
spec, and the spec wins.

### COMMIT: Lock Each Phase

After every verified phase in the plan:
- Commit with a message describing the behavior added.
- Each commit is a safe point you can return to.

## SDD vs TDD — Relationship

SDD and TDD are complementary, not competing:

| Concern | Governs |
|---|---|
| **SDD** | What to build and why (spec → plan → implement) |
| **TDD** | How to build it correctly (red → green → refactor) |

An SDD-governed feature uses TDD for its implementation. SDD operates at the
feature scope; TDD operates at the code scope.

## Red Flags — Stop If You Catch Yourself

| Red Flag | What It Really Means |
|---|---|
| Writing a plan before the spec is approved | You are guessing at scope |
| Writing code before the plan phase | You are skipping the design gate |
| Updating the implementation without updating the spec | Your spec is a lie |
| "I'll spec it after I build it" | You will not. And the spec will be a rationalization, not a design. |
| "The feature is simple, no spec needed" | Simple features have simple specs. Write it. |
| Skipping Open Questions because there are none | Write "- (none)" — the absence is the answer |
| "The plan is obvious from the spec" | Then writing the plan is fast. Write it. |

## SDD Checklist (Quick Reference)

- [ ] brainstorm-spec invoked before any planning.
- [ ] Spec has all required sections (Goal, Context, Assumptions, Decisions, AC, Open Questions, Out of Scope).
- [ ] Explicit user approval received before implementation-planner.
- [ ] implementation-planner invoked only after spec approval.
- [ ] Every AC in the spec maps to at least one plan task.
- [ ] No implementation code written before the plan is verified.
- [ ] After implementation, routed through `two-stage-review`; both stages passed (any fail looped back to IMPLEMENT).
- [ ] Each phase committed at green.
