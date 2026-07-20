---
name: ui-anti-pattern-rules
description: 'Use when editing UI surfaces (TSX/JSX/Vue/HTML/CSS/SCSS/Svelte) — 15 anti-pattern rules covering color, typography, accessibility, layout.'
user-invocable: false
---

# UI Anti-Pattern Rules

**Announce:** I'm using the ui-anti-pattern-rules skill to flag UI anti-patterns in this edit.

## Status

(emit on use — `DONE`, `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT`, or `BLOCKED`)

## Rules

See `abilities/rule-catalog.md` for the full 15-rule catalog. Each rule has an anti-pattern, a "why", and a "do instead" remediation:

1. `hardcoded-color` — use CSS custom properties / design tokens, not raw hex/rgb.
2. `inter-only-font` — always include a system-font fallback stack.
3. `missing-reduced-motion` — pair every `@keyframes`/`animation:` with a `prefers-reduced-motion` block (WCAG 2.3.3).
4. `low-contrast-text` — verify against WCAG AA (4.5:1 normal text, 3:1 large) with a checker.
5. `missing-alt-text` — every `<img>` needs an `alt`; decorative images use `alt=""` (WCAG 1.1.1).
6. `inline-style` — extract to class / CSS module / token; reserve inline only for truly dynamic values.
7. `magic-number-spacing` — multiples of 4px (or the project base unit); use spacing tokens.
8. `missing-focus-indicator` — never `outline: none` without a `:focus-visible` substitute (WCAG 2.4.7).
9. `deep-nesting` — flatten CSS selectors to 1–2 levels; BEM, CSS modules, or utilities.
10. `important-overuse` — multiple `!important` means refactor specificity, not escalate.
11. `fixed-width-container` — prefer `max-width` + `width: 100%` over fixed pixel widths.
12. `missing-label` — every `<input>` needs a `<label>`, `aria-label`, or `aria-labelledby` (WCAG 1.3.1 / 3.3.2).
13. `z-index-war` — no z-index above 10; use a named scale of layered tokens.
14. `non-semantic-div` — prefer `<section>` / `<article>` / `<nav>` / `<main>` over div-soup.
15. `no-skip-nav` — pages with `<nav>` or `<header>` need a "skip to main content" link (WCAG 2.4.1).

When flagging a violation, cite the rule slug (e.g., `low-contrast-text`) and the file:line. Open `abilities/rule-catalog.md` for the full "why" + "do instead" before recommending a fix.

## Why

Design systems exist to enforce consistency, accessibility, and maintainability at scale. Each rule above protects a different dimension of that promise: color tokens prevent brand drift, focus indicators protect keyboard users, semantic HTML preserves document structure, spacing scales ensure visual rhythm. Individually, any single violation is a minor issue. Collectively, accumulated anti-patterns compound into UIs that are inaccessible, unmaintainable, and visually inconsistent. Treating these rules as non-negotiable defaults — rather than optional polish — is what separates a production-grade UI codebase from a prototype.

## Done — status: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED
