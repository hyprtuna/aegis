---
name: orchestrator-guide
description: Use when orchestrating parallel agents — guidance on when to fan out, how to compose results, TDD discipline.
visibility: user
platforms: [claude, opencode, codex, cursor, zed]
---

# Orchestrator Guide

This is a reference document for orchestrating parallel subagents well. Read it before dispatching any Task() calls. The goal is not to fan out aggressively — it is to fan out *correctly*, compose outputs *accurately*, and know *when to stop and ask*.

---

## 1. When to Fan Out

Fan out **only when all three conditions hold**:

1. **The subtasks are genuinely independent.** No subtask needs the output of another to begin. If subtask B requires data from subtask A, they must run sequentially, not in parallel.
2. **Context can be cleanly partitioned.** Each subagent can be given a complete, self-contained prompt without referencing shared mutable state.
3. **There are 3 or more subtasks in the whole goal.** For 1-2 total subtasks the overhead of spawning, prompting, and collecting agents outweighs the marginal gain — do them inline. For 3+ subtasks, orchestration is the default even if the dependency graph is linear across waves — see the multi-wave example below.

**Do NOT fan out when:**
- Tasks are sequential by nature (e.g., "write code, then test it" — the test needs the code).
- Subagents would need to read each other's outputs mid-flight.
- The total work is small enough that a single agent can finish it in one pass.
- You are uncertain about the task decomposition — clarify first, then dispatch.

See `abilities/prompt-scoping-and-tdd.md` for concrete fan-out examples (audit-three-modules, rename-one-symbol, multi-wave feature release).

---

## 2. How to Scope a Subagent Prompt

Every Task() call spawns a **fresh agent with zero context** from your conversation. It cannot see your history, your previous outputs, or anything you haven't explicitly included in the prompt. Write each subagent prompt as if it will be read by a capable engineer who knows nothing about the task except what you tell them.

**A well-scoped subagent prompt must include:**

1. **The goal** — one sentence, unambiguous. What must be true when the agent finishes?
2. **The relevant file paths** — exact paths. Don't say "the authentication module"; say `src/auth/session.ts`.
3. **The expected output format** — what should the agent return? A markdown section? A JSON object? A list of findings? Be explicit.
4. **Constraints and what NOT to do** — if the agent must not modify certain files, say so. If it must not make API calls, say so. Silence is permission — be explicit about limits.
5. **The context the agent cannot infer** — if there's a relevant design decision, a known issue, or a naming convention, include it. The agent has no access to your memory.

For concrete good/bad prompt examples, see `abilities/prompt-scoping-and-tdd.md`.

---

## 3. How to Compose Outputs

After all subagents complete, you have a set of results. Composing them correctly is as important as dispatching correctly.

**The composition process:**

1. **Collect all results before synthesizing.** Do not start writing a synthesis while some agents are still running. Wait for all results.
2. **Check each result for completeness.** Did each agent address its assigned scope? If a result is clearly partial (e.g., it only covers half the files it was given), note the gap before synthesizing.
3. **Identify disagreements explicitly.** If agent A says "this function is safe" and agent B says "this function has a vulnerability," do not average them or pick one silently. Surface the disagreement: *"Agent A and Agent B produced contradictory assessments of X. Agent A found... Agent B found... The resolution depends on..."*
4. **Synthesize into a single coherent result.** After resolving or flagging disagreements, produce one unified output. Structure it clearly — the reader should not need to mentally merge multiple agent outputs themselves.
5. **Attribute findings to their source.** When reporting, indicate which subagent produced which finding. This aids debugging when a finding turns out to be wrong.

**Never:**
- Silently drop one agent's output in favor of another's.
- Average contradictory conclusions without noting the contradiction.
- Present a synthesis as if you generated it from scratch when it came from subagents.

---

## 4. Async-Turn Discipline

See `abilities/async-turn-discipline.md` for the five gotchas of background-agent dispatch: yielding-while-running prep, partial-completion handling, heterogeneous-result composition (hard/soft filters), the 2-per-wave retry cap, and notification-timing expectations (30s–8min round-trip).

---

## 5. When to Stop and Ask the Human

Orchestration is not autonomous at all costs. There are conditions where the correct action is to stop, surface the problem, and wait for human input.

**Stop and ask when:**

1. **Subagents return contradictory plans with no clear winner.** If two agents propose mutually exclusive approaches and neither is obviously correct, you cannot resolve this — the human must choose.
2. **The task requires human judgment or authorization.** Credentials, policy decisions, production deployments, legal or compliance questions — these are never for an agent to decide. Surface them immediately.
3. **Two or more subagents return BLOCKED status.** A BLOCKED result means an agent hit a wall it cannot get past. If this happens in multiple subtasks, the original task decomposition was likely wrong, or there is a systemic problem you need the human to resolve.
4. **The scope turns out to be larger than originally stated.** If exploration reveals the task will take 10x the expected work, stop and confirm before proceeding. Don't autonomously expand scope.
5. **You discover sensitive data or a security issue that requires human review.** Don't act on it unilaterally.

**How to stop and escalate:**
```
I need to pause and get your input before continuing.

Here is what I found:
- [Agent A result summary]
- [Agent B result summary]

The problem: [specific contradiction or blocker]

What I need from you: [specific question or decision]
```

Do not apologize excessively. State the problem, state what you have, state what you need.

---

## 6. TDD Loop Discipline

When the task involves writing or modifying code, orchestration must enforce the TDD loop. An agent that produces code without verifying it passes tests has not completed its subtask — it has produced a candidate. The mandatory chain is Plan → Implement → Test → Verify, and every code-writing subagent must end its output with the test command, the output, and a PASSING/FAILING statement.

**Do not accept a code result without test verification.** Re-dispatch on failure with the failing test output; escalate to the human after a second failure rather than dispatching blindly.

See `abilities/prompt-scoping-and-tdd.md` for the full chain spec, TDD-first workflow details, and the no-test-verification escalation pattern.
