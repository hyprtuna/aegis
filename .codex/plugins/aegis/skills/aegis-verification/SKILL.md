---
name: aegis-verification
description: 'Use before claiming completion — blocks claims without fresh verification evidence (tests, builds, lint).'
---

## Status
verification starting — running fresh verification gates before any completion claim

# Verifier — Evidence Before Claims

Every completion claim requires fresh, observable proof. No exceptions.

## When to Use

This skill activates at the end of any task that produces a deliverable — before any "done",
"tests pass", "build succeeds", or "it works" claim. If you used `test-driven-development`,
`develop`, `debugging`, or `orchestrate`, run the gate before declaring completion.

The full 5-step gate (IDENTIFY → RUN → READ → VERIFY → CLAIM), the GOOD/BAD example, the
claims-requiring-verification table, the red-flag and rationalization tables, and the output
format all live in `abilities/gate-detail.md`. This body carries the Iron Law and the forks.

## The Iron Law

<HARD-GATE>
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE.

You do not get to say "tests pass" without test output in front of you. You do
not get to say "build succeeds" without a build you just ran. You do not get to
say "it works" without demonstrating the exact behavior.

Stale evidence is not evidence. Memory is not evidence. Confidence is not
evidence. Only fresh command output, produced now, is evidence.

This gate lifts ONLY when you have run the proving command in this session and
read its actual output. "I ran it earlier" does not lift it.
</HARD-GATE>

## The 5-Step Gate (summary)

Every claim passes through all five steps in order; skipping a step invalidates the claim:

1. **IDENTIFY** — what command proves this claim? If none exists, you cannot make the claim.
2. **RUN** — execute it now, in full, no stale caches.
3. **READ** — exit code, failure count, unexpected output, skipped items.
4. **VERIFY** — output confirms → Step 5; output contradicts → STOP and state actual status.
5. **CLAIM** — make the claim, citing the evidence directly.

Per-step detail, the command examples, and the claims table are in `abilities/gate-detail.md`.

## Decision Forks

- **About to claim done?** → run the 5-step gate first; cite fresh output.
- **Output contradicts the claim?** → STOP, report the actual status, do not rationalize
  ("mostly passes" / "basically works" are forbidden). Fix, then re-run from Step 1.
- **Catching a red-flag thought** ("should work", "probably fine", "I already checked earlier")?
  → that is the signal to run the gate. See the red-flag and rationalization tables in the ability.
- **Reporting results?** → use the `## Verification` block format (one block per claim) from the ability.

## REQUIRED SUB-SKILL: finishing-branch

Once the gate is green and the claim is backed by fresh output, the work is ready to land. Hand off
to `aegis:finishing-branch` to decide between merge, PR, keep, or discard. Verification is the last
quality gate before that decision, not the end of the chain.

## Done
verification done — verification gates executed with fresh evidence; status: DONE
