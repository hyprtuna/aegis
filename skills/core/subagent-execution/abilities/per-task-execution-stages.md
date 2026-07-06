# Per-Task Execution Stages

On-demand reference detailing the five stages of the per-task execution loop. The parent `SKILL.md` covers the core principle, before-starting checklist, model selection summary, after-all-tasks workflow, and the hard rules.

Execute tasks sequentially, one at a time. Never dispatch multiple implementers in parallel — file conflicts and merge pain are not worth the time savings.

## Stage 0: Prepare Context

Before dispatching the implementer, gather everything it needs:

- **Full task text.** Copy the entire task (title, files, action, verification, acceptance) into the subagent prompt. Never tell the subagent to "read the plan file" — that wastes its turns and risks misinterpretation.
- **Relevant file contents.** If the task modifies existing files, read them and include key sections (types, interfaces, function signatures the task will interact with).
- **Conventions.** Include the project's CLAUDE.md rules that apply to this task (import rules, naming, test framework, etc.).
- **Prior task outputs.** If this task depends on files created by earlier tasks, confirm those files exist and summarize what they export.

## Stage 1: Dispatch Implementer

Dispatch a fresh subagent via Task() with:

- The complete task text (from the plan, verbatim)
- All context gathered in Stage 0
- Clear instruction: "Implement this task. When done, report DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, or BLOCKED."
- Model selection based on task complexity (see Model Selection below)

## Stage 2: Handle Implementer Response

The implementer will return one of four statuses:

- **DONE** — Implementation complete, proceed to review.
- **DONE_WITH_CONCERNS** — Implementation complete but the subagent flagged concerns. Read the concerns. If they are about correctness (wrong approach, missing edge case, spec ambiguity), address them before review. If they are about style or preference, proceed to review.
- **NEEDS_CONTEXT** — The subagent could not complete the task because it lacked information. Provide the missing context and re-dispatch a fresh subagent (do not reuse the same one).
- **BLOCKED** — The subagent hit an obstacle it cannot resolve (missing dependency, broken build, spec contradiction). Assess the blocker. If you can resolve it (install a dependency, fix a prior task's output), do so and re-dispatch. If not, escalate to the user with a clear description of what is blocked and why.

## Stage 3: Spec Compliance Review

After the implementer reports DONE, dispatch a fresh review subagent to verify spec compliance. This reviewer checks whether the implementation matches the task specification — nothing more.

Provide the reviewer with:
- The original task text (identical to what the implementer received)
- The list of files changed (from the implementer's report)
- Instruction: "Does this implementation match the task spec? Check: all requirements met, nothing missing, nothing extra. Report PASS or FAIL with specific findings."

**If FAIL:** Read the reviewer's findings. Dispatch a fresh implementer subagent with the original task text plus the review findings. The implementer fixes the issues. Then re-dispatch the spec compliance reviewer. Repeat until PASS (max 3 cycles — if still failing after 3 cycles, escalate to the user).

## Stage 4: Code Quality Review

Only after spec compliance passes. Dispatch a fresh review subagent to check code quality. This reviewer evaluates whether the implementation is well-built — not whether it matches the spec (that was already verified).

Provide the reviewer with:
- The files changed
- The project's CLAUDE.md conventions
- Instruction: "Review this code for quality: error handling, type safety, naming, test coverage, patterns, duplication. Report PASS or FAIL with specific findings. Only flag issues at confidence >= 80%."

**If FAIL:** Read the findings. Dispatch a fresh implementer subagent with the quality review findings and the original task context. The implementer fixes the issues. Then re-dispatch the quality reviewer. Repeat until PASS (max 3 cycles — escalate if still failing).

## Stage 5: Mark Complete

After both reviews pass:

1. Update the TodoWrite checklist — mark this task as complete
2. Verify the codebase is in a valid state: run the verification command from the plan
3. Commit the changes with a conventional commit message derived from the task title
4. Move to the next task

## Controller context-hygiene + durable progress (large-plan dispatch)

Three techniques keep a long multi-task dispatch run cheap and crash-safe. They matter most once a
plan has enough tasks that the controller's context risks compaction.

**1. Hand large artifacts as files, not pasted text.** Everything you paste into a dispatch prompt
-- and everything a subagent prints back -- stays resident in your context for the rest of the run
and is re-read every turn. For a full task brief, a diff, or an implementer report, write it to a
file and pass the *path*; the subagent reads it and writes its report to a named file you read back.
(Small, task-specific values -- magic strings, signatures, the one-line goal -- still go inline so
the dispatch stays self-contained; this trims the *bulk*, it does not contradict "give each subagent
everything it needs.") Put handoff files at an ABSOLUTE path under `.aegis-scratch/`, never under
`.git/` -- see `rules/scratch-dir-convention.md` for the path and the `.git/`-denial reason.

**2. Pin explicit SHAs in dispatch prompts -- never a moving ref.** A dispatch that says "review the
diff since `HEAD~1`" (or `HEAD`) drifts the moment another commit lands: the agent reviews the wrong
range. Resolve the concrete SHA first (`git rev-parse HEAD`, or a `git merge-base main HEAD` for a
whole-branch range) and embed that literal SHA. The range you mean is the range the agent sees.

**3. Keep a durable append-only progress ledger.** TodoWrite (the in-context "single source of
truth" above) does NOT survive compaction -- controllers that lost their place have re-dispatched
entire completed task sequences, the single most expensive failure observed. Mirror completion into
a ledger FILE at an absolute path under `.aegis-scratch/` (e.g. `.../progress.md`). When a task's
review comes back clean, append one line: `Task N: complete (commits <base7>..<head7>, review
clean)`. (The 7-char abbreviated range is human-readable shorthand for display in the ledger;
cross-check against `git log` using the full SHA — point 2 above governs dispatch prompts, not
the ledger display.) On resume after compaction, trust the ledger + `git log` over your own recollection; the
commits it names exist in git even when your context no longer remembers creating them.

*Not to be confused with:* the *research* `HYPOTHESIS[id]` ledger (claim state) lives in
`autonomous-execution`; the `recall` `progress` memory type is durable cross-session
human-curated memory, not this per-run dispatch-recovery scratch file.

## Model Selection by Task Complexity

Not every task needs the most capable (and expensive) model. Match the model to the work:

| Complexity | Characteristics | Model Tier |
|---|---|---|
| **Mechanical** | 1-2 files, copy-paste pattern, clear spec, no design decisions | Fast/cheap (`haiku` or `sonnet`) |
| **Integration** | 3-5 files, follows established patterns, some wiring decisions | Standard (`sonnet` with high effort) |
| **Architecture** | New patterns, API design, complex type relationships, multiple valid approaches | Most capable (`opus`) |

When in doubt, use the standard tier. Underspending on a complex task costs more in review cycles than overspending on a simple one.

For review subagents, always use the standard tier or above. Cheap models miss issues.

**Always specify the model explicitly when dispatching.** An omitted model inherits the session's model — often the most capable and most expensive — silently defeating this table.

**Turn count beats token price.** Wall-clock and context cost scale with how many *turns* a subagent takes, and the cheapest models routinely take 2–3× the turns on multi-step work — costing more overall. Treat the standard tier as the floor for implementers and reviewers; reserve the cheapest tier for single-file mechanical fixes.
