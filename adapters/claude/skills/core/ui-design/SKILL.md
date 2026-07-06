---
name: ui-design
description: 'Use when designing UI/UX surfaces — visual hierarchy, spacing, colour, typography, accessibility.'
---

> **Invoke via `Skill({skill: "aegis:ui-design"})`.** This is a skill, not an agent. If you reached for the Agent tool, you're using the wrong primitive.

# UI/UX Designer

**Announce:** I'm using the ui-design skill to craft a visually distinctive, accessible, and functionally clear interface. I'll coordinate color, typography, and style decisions from the sub-skills, then synthesise them into a unified design recommendation.

## Coordinator role

This skill coordinates three specialist sub-skills, each invoked in declared order before this body runs:

1. **color-palette-design** — WCAG-AA role-based palette with dark-mode derivation
2. **typography-pairings** — display/body font pairings by industry and style mood
3. **style-selection** — named visual style family (Brutalist, Soft UI, Glassmorphism, etc.)

Their outputs are available in the `<sub-skill-outputs>` block in your context. Use them as the foundation for the unified design recommendation below.

## Synthesising sub-skill outputs

When `<sub-skill-outputs>` is present in context, integrate the results:

- **Color**: take the role-based palette from `color-palette-design` (primary, secondary, CTA, background, text, border, semantic tokens).
- **Typography**: take the display/body pairing and modular scale from `typography-pairings`.
- **Style**: take the named style family and component language from `style-selection` — let it govern spacing, border-radius, shadow depth, and interaction style.

If sub-skill outputs are absent (direct invocation without sub-skills), make your own colour, typography, and style decisions using the design principles below.

## Unified design recommendation

This skill is the producer for the `visual-exploration` template kind — there is no separate `visual-exploration` skill. The kind's index default is `html`, but the working artifact here is prose exploration notes, so request the **markdown** variant explicitly (honoring the index default rather than flipping it). Capture the recommendation as labeled direction notes following the `visual-exploration` markdown structure:

# {{ slot.title }}

> **Context** — {{ slot.context }}

## Directions

<!-- Render one block per direction. Repeat the block below once per entry in the directions array (see shape). -->

### {{ slot.direction.name }}

{{ slot.direction.notes }}

Each direction's notes carry the synthesised design decisions:

- **Palette** — role-based palette tokens from `color-palette-design`, or derived.
- **Typography** — display/body pairing and modular scale from `typography-pairings`, or derived.
- **Style** — named style family and component language from `style-selection`, or derived.
- **Component decisions** — each component with spacing, border-radius, shadow, interaction state.
- **Accessibility checklist** — WCAG AA contrast pairs confirmed; keyboard nav; focus indicators; reduced-motion.

For structured variant data another tool ingests, emit the `visual-exploration` **json** variant. For browseable mockup cards as a standalone deliverable, render the `visual-exploration` **html** variant on request. Both are on-request only — the markdown notes above are the working default.

You are a designer-turned-developer. You craft interfaces that are visually distinctive, functionally clear, and accessible by default.

## Design Principles

1. **Visual hierarchy first**: Guide the eye. The most important element should be the most prominent.
2. **Whitespace is a feature**: Generous spacing > cramming elements. Let content breathe.
3. **Consistency over novelty**: Reuse existing components before creating new ones. Match existing patterns.
4. **Accessibility is non-negotiable**: Proper contrast ratios, semantic HTML, keyboard navigation, screen reader support.
5. **Progressive enhancement**: Works without JS first. Add interactivity as enhancement.
6. **Mobile-first**: Design for the smallest screen, scale up.

## The 6 Pillars (Audit Checklist)

### 1. Visual Hierarchy
- Is the primary action obvious?
- Does the eye flow naturally through the content?
- Are headings, body text, and captions visually distinct?

### 2. Spacing & Layout
- Consistent padding and margins (use a spacing scale: 4, 8, 16, 24, 32, 48, 64px)
- Logical grouping (related elements close, unrelated elements apart)
- Responsive behavior at all breakpoints

### 3. Color
- Cohesive palette (max 3-4 colors + neutrals)
- Sufficient contrast (WCAG AA: 4.5:1 for body text, 3:1 for large text)
- Color alone never conveys meaning (always pair with text/icon)

### 4. Typography
- Maximum 2 font families
- Clear size hierarchy (heading, subheading, body, caption)
- Readable line length (45-75 characters)
- Adequate line height (1.4-1.6 for body text)

### 5. Component Consistency
- Buttons look and behave the same everywhere
- Form inputs have consistent styling and behavior
- Cards, lists, tables follow the same visual language
- Icons from a single family, consistent size

### 6. Accessibility
- All images have alt text
- All form fields have labels
- Focus indicators visible
- Skip navigation link
- ARIA attributes where semantic HTML isn't enough
- Reduced motion support (`prefers-reduced-motion`)

## Design Contract (UI-SPEC)

Before implementing a UI feature, produce a brief design contract:

```
## UI Specification: [feature name]

### Layout
- [sketch description: what goes where]
- [responsive behavior at mobile/tablet/desktop]

### Components
- [list of components to use/create]

### States
- [empty state, loading state, error state, success state]

### Interactions
- [hover, click, keyboard, animation]

### Accessibility
- [specific ARIA roles, labels, keyboard behavior]
```

## Rules

- Always check the existing design system before creating new components
- Use CSS custom properties (variables) for colors, spacing, typography
- Test at 320px, 768px, and 1440px viewport widths
- Run Lighthouse accessibility audit after implementation
- **Verify the rendered output empirically.** Confirm the design against what the host can actually render — a browser, a screenshot tool, or a measurement — not against the source alone. A screenshot you did not read back is not verification. Detector or lint output is defect evidence only; passing it never proves the work is done.

## See also — sub-skills

The `ui-design` audit flags issues; the sub-skills help you construct a system that doesn't produce those issues in the first place.

- [`style-selection`](../style-selection/SKILL.md) — pick a named visual style by industry.
- [`color-palette-design`](../color-palette-design/SKILL.md) — construct a WCAG-AA palette with dark-mode derivation.
- [`typography-pairings`](../typography-pairings/SKILL.md) — display/body pairings by industry; avoid the Inter-only default.
- [`ux-reasoning-rules`](../ux-reasoning-rules/SKILL.md) — 25 high-leverage UX rules as a review checklist.
