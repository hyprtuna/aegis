# Screen Audit Checklist

On-demand audit template. Use after walking the rule catalog (`abilities/rule-catalog.md`) against a specific screen.

```
Screen: [screen name]
Auditor: [agent / user]
Date: [date]

Section 1 · Perception & cognition
  [ ] 1 · Fitts: primary CTA positioned for easy acquisition         PASS / DRIFT / N/A
  [ ] 2 · Hick: option count manageable; groups applied if >7        PASS / DRIFT / N/A
  [ ] 3 · Miller: cross-step memory burden < 5 items                 PASS / DRIFT / N/A
  [ ] 4 · Recognition: affordances visible; not hidden               PASS / DRIFT / N/A
  [ ] 5 · Disclosure: advanced shown only when needed                PASS / DRIFT / N/A
  [ ] 6 · Hierarchy: size→weight→colour order respected              PASS / DRIFT / N/A
  [ ] 7 · Proximity: grouping matches semantic relationship           PASS / DRIFT / N/A

Section 2 · State design
  [ ] 8 · States: idle/hover/focus/disabled all present              PASS / DRIFT / N/A
  [ ] 9 · Empty state: instructive, not just blank                   PASS / DRIFT / N/A
  [ ] 10 · Loading: matches duration range + final layout            PASS / DRIFT / N/A
  [ ] 11 · Error: specific, recoverable, not blamey                  PASS / DRIFT / N/A
  [ ] 12 · Skeleton: used for known layouts > 1s load                PASS / DRIFT / N/A
  [ ] 13 · Destructive: confirmation + appropriate friction          PASS / DRIFT / N/A
  [ ] 14 · Undo: reversible actions use undo pattern where feasible  PASS / DRIFT / N/A

Section 3 · Interaction & input
  [ ] 15 · Defaults: fields pre-filled with most common answer       PASS / DRIFT / N/A
  [ ] 16 · Sort: lists sorted by usefulness, not alphabet            PASS / DRIFT / N/A
  [ ] 17 · Targets: touch targets ≥ 44×44pt on mobile               PASS / DRIFT / N/A
  [ ] 18 · Focus ring: visible, branded, ≥ 3:1 contrast             PASS / DRIFT / N/A
  [ ] 19 · Tab order: follows visual reading order                   PASS / DRIFT / N/A
  [ ] 20 · Keyboard: all elements reachable; modal traps focus       PASS / DRIFT / N/A

Section 4 · Motion & feedback
  [ ] 21 · Feedback: action response < 100ms                         PASS / DRIFT / N/A
  [ ] 22 · Reduced motion: prefers-reduced-motion guard present      PASS / DRIFT / N/A
  [ ] 23 · Easing: single easing model applied consistently          PASS / DRIFT / N/A

Section 5 · Content
  [ ] 24 · One CTA: single primary action; others subordinate        PASS / DRIFT / N/A
  [ ] 25 · Copy: verbs on buttons, specific errors, clear states     PASS / DRIFT / N/A

Section 6 · Empirical verification
  [ ] 26 · Rendered: output verified in a real render (browser/      PASS / DRIFT / N/A
           screenshot read back), not from source alone

DRIFT count: ___
Action: If > 5 DRIFT items on one screen, pause and reassess component hierarchy.
```

## Scoring guide

- **0–2 DRIFT:** Production-ready for this screen.
- **3–5 DRIFT:** Fix before shipping; document accepted trade-offs.
- **6+ DRIFT:** Structural issue. Revisit the component hierarchy before patching individual symptoms.
- **Any DRIFT on rules 17, 18, 19, 20, 22:** Accessibility blocker. Fix before merge.
