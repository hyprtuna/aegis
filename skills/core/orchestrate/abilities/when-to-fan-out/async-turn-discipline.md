# Async-Turn Discipline

On-demand reference for background-agent communication gotchas. The parent `SKILL.md` covers when to fan out, prompt scoping, composing outputs, when to stop and ask, and TDD-loop discipline.

Background agents (`run_in_background: true`) communicate via completion notifications. Between notifications the UI shows nothing moving. Five concrete gotchas follow from this model.

## 1. Yielding While Agents Run

Do not yield with a bare "awaiting the others..." message while agents are in flight. Fill the waiting turn with non-blocking prep: read the source files the next wave will need, pre-verify assumptions via a dry-run CLI command (e.g., `./bin/aegis.cjs route --json "<prompt>"`), draft CHANGELOG entries, or check git state. This work informs the next dispatch's prompts with zero wasted latency.

When 1-of-3 agents returns while two are still running, use the remaining turn to read the files the next wave will touch and pre-verify assumptions — this means the moment the last notification arrives you can dispatch immediately with fully-formed prompts rather than spending that turn on reads.

If nothing productive remains to prep, yield with a structured message that names the in-flight agents: *"Waiting on agent-2 (selector tuning) and agent-3 (test tightening). agent-1 (banner wire-up) returned DONE."*

## 2. Partial Completion Handling

When one agent in a wave returns a partial or blocked result while others are still running, do not re-dispatch immediately. Wait for the full wave to report first. Re-dispatching mid-wave risks solving a phantom problem because:

- A sibling agent may have already addressed the overlapping concern.
- The apparent blocker may be resolved by work a sibling agent is producing right now.
- Dispatching a duplicate into a live wave risks conflicting edits to shared files.

Gather the whole wave, assess the combined state, then decide whether a re-dispatch is needed and what its scope should be.

## 3. Heterogeneous Result Composition

When wave results arrive in mixed states (some `DONE`, some partial, some failed), do not majority-vote or average the outputs. Apply these filters in order:

1. **Hard filter:** keep only results that pass all tests. A partial result that leaves tests red is not a candidate.
2. **Soft filter:** among surviving results, prefer the one most closely aligned with the original goal statement.

If two agents edited the same file with different approaches, keep one result entirely and discard the other. Do not attempt to merge. Merges of independently-generated code almost always introduce inconsistencies that neither agent's tests cover.

## 4. Cascade Failure Retry Budget

The "retry once on failure" rule can cascade into dispatch budget exhaustion when five agents all hit the same root cause (a broken dependency, a missing fixture, a mis-specified interface). Cap retries at **2 per wave**. If two retries have already been consumed in the current wave, escalate to the user rather than retrying further. Describe the common root cause as specifically as you can — the human can resolve systemic blockers faster than a third dispatch attempt.

## 5. Notification Timing Expectations

Typical background-agent round-trip is 30 seconds to 8 minutes depending on scope. Treat durations above 5 minutes as cache-boundary territory — a stalled notification after 8+ minutes usually means the agent hit a hard stop rather than completing silently. When dispatching an agent whose task is likely to take more than 2–3 minutes, include an expected duration in the dispatch prompt ("this sub-task should take roughly 5 minutes"). This sets your own expectation correctly so you know whether to keep prepping (under 5 minutes remaining) or to yield and wait for the notification (work is complete and you have nothing left to prep).
