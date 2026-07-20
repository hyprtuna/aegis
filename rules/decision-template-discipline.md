---
name: decision-template-discipline
description: Use when a skill renders a decision via the canonical decision template — wait for the user's answer unless --accept-defaults is set or auto-mode is active and the recommendation is high-confidence.
visibility: user
platforms: [claude, opencode, codex, cursor, zed]
---

# decision-template-discipline

> **Scope lane — WHAT-questions.** Fires when a skill renders a decision template carrying a real question — which option / approach / design? — and STOP-and-WAITs for the user's answer (unless a carve-out applies). Sibling (kept separate, do not merge): `user-choice-discipline` governs the **WHERE/HOW** dimension — output location and format — via `AskUserQuestion`. This rule owns the "which substantive choice?" wait only; it does not touch the location/format fork.

## The rule

<HARD-GATE phase="decision">
When a skill renders a `${TEMPLATE:decisions}` block carrying a real
question (not a placeholder, not example prose), STOP and WAIT for the
user's answer before continuing.

This gate lifts ONLY when one of the following carve-outs applies:

1. **Accept-defaults carve-out.** The user explicitly authorised defaults
   for this run — `--accept-defaults` flag, `auto_decisions: true` in the
   runtime context, or an equivalent opt-in. The agent emits the
   recommended option, logs an audit-trail entry, and proceeds.

2. **Auto-mode + high-confidence carve-out.** Auto-mode is active AND the
   prompt's `confidence` field is `'high'`. The agent emits the
   recommended option, logs an audit-trail entry, and proceeds.

Anywhere else — auto-mode active but confidence missing/low/medium, no
recommended option, multiple recommendations, or no explicit opt-in — the
agent WAITS. Free-form prose, ambiguous "sounds good" replies, and silent
defaults do NOT satisfy this gate.
</HARD-GATE>

## Why this exists

Decisions are the most expensive thing to get wrong. The cheapest moment
to redirect a plan is *before* the agent commits to one of the options;
the most expensive is after the diff lands. The decision template
surfaces the choice as a structured question with options and a
recommendation; this rule ensures the surface is *honoured* — the agent
treats the prompt as a real interaction, not decoration.

Auto-mode is dangerous here. Without this rule, an autonomous run would
silently pick the recommendation every time and the user would discover
the choice in the commit log. The carve-outs above are intentional and
narrow:

- `--accept-defaults` is an *explicit* user authorisation. The user told
  us to skip waits; we comply.
- `auto-mode + confidence: 'high'` is a deliberate calibration signal. A
  skill that emits a high-confidence recommendation is asserting "this
  one's routine — proceed." Anything below that bar waits.

## When to use

- Any skill that produces a `${TEMPLATE:decisions}` block at runtime
  (`brainstorm-spec` and its `exploring-intent` / `adr` fragments,
  `implementation-planner`, `research`'s `framework-comparison` fragment, …).
- Any agent that consumes a decision prompt rendered by such a skill.

## Auto-mode contract

When auto-mode is active, the runtime must determine whether to auto-select or wait.
The decision logic:

1. If `acceptDefaults` is explicitly set → auto-select the recommended option and log an audit entry.
2. If auto-mode active AND `confidence === 'high'` → auto-select and log an audit entry.
3. Otherwise → surface the prompt and WAIT.

The audit entry must record: the prompt question, the selected label, the timestamp, and the reason for auto-selection (accept-defaults or auto-mode + confidence).

## Anti-patterns

- **Silent defaults.** Emitting a recommendation in the body and then
  acting on it without an explicit user signal. This is the failure mode
  the rule was written to prevent.
- **Stretching "approved".** A vague "sounds good" or "ok" is not a
  selection. The user MUST name an option label.
- **Lowering the bar.** Treating `confidence: 'medium'` as eligible for
  auto-select. The bar is `'high'` and only `'high'`.
- **Skipping the audit log.** Even when auto-select is correct, the
  audit-trail entry is mandatory. It is the user's only retroactive view
  into what the agent decided on their behalf.
