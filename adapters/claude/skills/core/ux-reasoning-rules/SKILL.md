---
name: ux-reasoning-rules
description: 'Use when applying UX reasoning rules — 25 rules from perception laws, state design, accessibility, copy-as-UI; includes a screen-audit checklist.'
user-invocable: false
---

# ux-reasoning-rules

A distilled rule set drawn from perception psychology, heuristic evaluation, and practical design patterns. Use as a review checklist — walk all 25 rules against a target screen before calling it done.

## How to use

1. **Open the rule catalog.** Read `abilities/rule-catalog.md` — each rule has a title, rationale, concrete example, and common violation. The 25 rules are grouped into 5 sections (Perception, State, Interaction, Motion, Content).
2. **Audit a target screen.** Walk each rule against the screen. Record PASS / DRIFT / N/A using the template in `abilities/audit-checklist.md`.
3. **Score and act.** 0–2 DRIFT → ship. 3–5 DRIFT → fix before shipping. 6+ DRIFT → structural issue, revisit component hierarchy. Any DRIFT on rules 17, 18, 19, 20, 22 → accessibility blocker, fix before merge.

## Rule sections (index)

- **Section 1 · Perception & cognition (rules 1–7):** Fitts, Hick, Miller, recognition-over-recall, progressive disclosure, size→weight→colour hierarchy, proximity law.
- **Section 2 · State design (rules 8–14):** four-state minimum (idle/hover/focus/disabled); empty states teach; loading states match duration; errors specific + recoverable; skeleton screens beat spinners; destructive actions require friction; undo beats confirm.
- **Section 3 · Interaction & input (rules 15–20):** default to most-common answer; sort by usefulness; touch targets ≥ 44×44pt; visible branded focus ring; tab order = visual order; keyboard-first navigation with focus traps.
- **Section 4 · Motion & feedback (rules 21–23):** feedback within 100ms; respect `prefers-reduced-motion`; consistent easing model.
- **Section 5 · Content & composition (rules 24–25):** one primary CTA per view; copy is UI (verbs on buttons, specific errors, first-person settings, apology-free messages).

See `abilities/rule-catalog.md` for the full text of every rule.

## Accessibility-blocker rules

Rules **17, 18, 19, 20, 22** are non-negotiable. Any DRIFT on these blocks the merge regardless of overall score. They map to WCAG 2.1 Level AA requirements (touch-target size, focus visibility, tab order, keyboard access, reduced motion). Treat as load-bearing.

## See also

- `aegis:ui-design` — 6-pillar audit that this checklist feeds into.
- `aegis:style-selection`, `aegis:color-palette-design`, `aegis:typography-pairings` — construction phase; resolve before running this checklist.
- `aegis:design-system-generation` — token step; rule §25 (single-source tokens) verifies the system.
