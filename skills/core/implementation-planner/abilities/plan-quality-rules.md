# Plan Quality Rules

On-demand reference: forbidden placeholder tokens and the required-task-fields table. The parent `SKILL.md` covers the workflow, prompt overrides, plan structure, and self-review checklist.

## No Placeholders Rule

The following tokens are **forbidden** in any plan you produce. A plan verifier will flag these and fail the audit if any are found:

| Forbidden token | Why it is unacceptable |
|---|---|
| `TBD` | Not a plan — it is a defer. Research and fill in now. |
| `tbd` | Same as above (case-insensitive). |
| `<placeholder>` | A template stub that was never filled. |
| `…` (ellipsis) | Implies omitted steps. Steps must be explicit. |
| `XXX` | Convention for "needs fixing" — fix it before committing the plan. |
| `???` | Unresolved ambiguity. Resolve it or raise as a blocking open question. |
| `lorem ipsum` | Filler text with no semantic content. |
| `TODO` | A reminder, not an instruction. Write the instruction. |
| `implement later` | Scope deferral without a plan. Either include it or exclude it explicitly. |
| `fill in later` | Same as above. |
| `add appropriate validation` | Vague. Name the schema, the fields, and the error messages. |
| `handle errors appropriately` | Vague. Name the error type and the recovery path. |
| `similar to above` | Ambiguous reference. Repeat the concrete details inline. |
| `as needed` | Conditional without a condition. Make the condition explicit. |
| `if necessary` | Same as above. |
| `when appropriate` | Same as above. |

Every step must have complete, concrete details. If you do not know a detail, research it before writing the task. If research cannot resolve it, raise it as a blocking open question that must be answered before the plan can proceed.

## Inline Self-Review Checklist

Run this checklist inline before saving the plan. Every box must be checked.

- [ ] Phases ordered correctly? Each phase depends only on previously completed phases.
- [ ] Tests TDD-disciplined? Every implementation task has a corresponding test task that precedes it and defines the acceptance criteria.
- [ ] Files tagged EXTEND/NEW? Every file in the plan is tagged `[EXTEND]` (modifying an existing file) or `[NEW]` (creating a new file) so the executor knows what to expect.
- [ ] Acceptance criteria observable? Each task's acceptance criterion is a runnable command or a binary observable fact — not a subjective judgment.
- [ ] Risks named? At least one risk identified per non-trivial phase, with a mitigation strategy.
- [ ] Verification commands runnable? Every `Verification:` field contains a command that can be copied and pasted into a terminal and produces deterministic output.
- [ ] No forbidden placeholders? Plan body passes the No Placeholders Rule (no TBD, XXX, …, etc.).

## What Every Task Must Have

| Field | Requirement | Bad example | Good example |
|---|---|---|---|
| **Files** | Exact paths from project root | "the relevant files" | `src/core/config.ts`, `tests/core/config.test.ts` |
| **Action** | Complete code or unambiguous instructions | "add validation" | "Add a Zod schema `ConfigSchema` with fields: name (string), version (semver string), debug (boolean, default false)" |
| **Verification** | Runnable command with expected output | "verify it works" | `npm run typecheck && npm test -- --grep "ConfigSchema"` |
| **Acceptance** | Observable, binary criteria | "it should be good" | "typecheck passes, 3 new tests pass, config.ts exports ConfigSchema" |

Each task also carries an **Interfaces:** block — `Consumes:` (what it uses from earlier tasks — exact signatures) and `Produces:` (what later tasks rely on — exact names, parameter and return types). A task's executor sees only their own task, so this block is how they learn the names and types neighboring tasks expose.

## Task Granularity Rules

- Each task should take 2–10 minutes of focused work for a skilled agent.
- Each task must be independently verifiable — a specific command proves it is done.
- Each task must leave the codebase in a valid state: tests pass, types check, no lint errors.
- Each task is a commit boundary. The commit message should be obvious from the task title.
- If a task touches more than 3 files, consider splitting it.
- If a task description exceeds 40 lines, it is doing too much.
- **Right-sizing test:** a task is the smallest unit that carries its own test cycle and is worth a fresh reviewer's gate. Fold setup, configuration, scaffolding, and documentation into the task whose deliverable needs them; split only where a reviewer could meaningfully reject one task while approving its neighbor.

## Scope Check

Before finalizing the plan, verify scope:

- If the plan covers multiple independent subsystems, split into separate plans — each should produce working, testable software independently.
- More than 15 tasks is a warning sign; more than 20 means the plan is too large — split it.
- Flag any task that depends on work outside this plan.

## Dependency Ordering

Tasks must be in dependency order. No task may reference a file, type, or function created by a later task. After ordering:

- Verify there are no forward references.
- Verify the first task can be executed on the current codebase as-is.
- Verify the last task includes a final integration verification step.
