---
name: design-system-generation
description: 'Use when generating an opinionated design system with industry-specific presets — colours, typography, spacing, components.'
---

> **Invoke via `Skill({skill: "aegis:design-system-generation"})`.** This is a skill, not an agent. If you reached for the Agent tool, you're using the wrong primitive.

## Purpose

Generate a complete, production-ready design system customized to the project's industry vertical. Output structured design tokens as CSS custom properties (or JSON/JS if requested), covering colors, typography, spacing, border radius, shadows, and breakpoints.

Detect or ask for the industry vertical, select the matching preset, incorporate any existing brand assets, then produce token files and component usage examples.

---

## Industry Presets

| Industry   | Palette                        | Typography                        | Character                    |
|------------|--------------------------------|-----------------------------------|------------------------------|
| SaaS       | Blue primary, neutral grays    | Inter/system, clean               | Professional, minimal        |
| Fintech    | Navy/green, trust tones        | Conservative, serif accent        | Trustworthy, stable          |
| Healthcare | Teal/white, calming            | High-contrast, accessible         | Calm, professional           |
| E-commerce | Warm accent, conversion-focused| Bold headings, readable body      | Energetic, action-oriented   |
| Media      | Dark mode default, vivid accent| Large headings, immersive         | Content-first, dramatic      |
| Education  | Warm pastels, friendly         | Rounded, approachable             | Welcoming, readable          |

---

## Design Token Categories

### Colors

Produce a full 50–900 scale for each role:

- **Primary** — main brand color (buttons, links, active states)
- **Secondary** — supporting brand color (badges, highlights)
- **Accent** — call-to-action contrast color
- **Neutral** — grays for text, borders, backgrounds
- **Semantic** — `success`, `warning`, `error`, `info` with 3-stop scales

### Typography

- **Font stack**: body font, heading font, monospace font (always include system fallbacks)
- **Size scale** (rem, based on 16 px root): 12 px · 14 px · 16 px · 18 px · 20 px · 24 px · 30 px · 36 px · 48 px
- **Weight scale**: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- **Line height**: tight (1.25), snug (1.375), normal (1.5), relaxed (1.625)
- **Letter spacing**: tight (−0.025em), normal (0em), wide (0.025em), wider (0.05em)

### Spacing

4 px base grid. Token scale:

| Token     | Value   |
|-----------|---------|
| `space-1` | 0.25 rem (4 px)  |
| `space-2` | 0.5 rem  (8 px)  |
| `space-3` | 0.75 rem (12 px) |
| `space-4` | 1 rem    (16 px) |
| `space-6` | 1.5 rem  (24 px) |
| `space-8` | 2 rem    (32 px) |
| `space-12`| 3 rem    (48 px) |
| `space-16`| 4 rem    (64 px) |
| `space-24`| 6 rem    (96 px) |

### Border Radius

`none` · `sm` (0.25 rem) · `md` (0.375 rem) · `lg` (0.5 rem) · `xl` (0.75 rem) · `2xl` (1 rem) · `full` (9999 px)

### Shadows

| Token       | Value                                      |
|-------------|--------------------------------------------|
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)`              |
| `shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)` |
| `shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)` |

### Breakpoints

`xs` 320 px · `sm` 640 px · `md` 768 px · `lg` 1024 px · `xl` 1280 px · `2xl` 1440 px

---

## Output Format

This skill is the producer for the `design-system` template kind. That kind ships **html + json only** (no markdown variant): the JSON variant is the working token data artifact, and the HTML variant is the visual reference deliverable. Emit the JSON token data following the `design-system` json structure exactly:

Read the template at `${CLAUDE_PLUGIN_ROOT}/templates/json/design-system/default.json` and follow its structure exactly.

The `swatches`, `typeScale`, `spacing`, and `components` arrays carry the colour scale, type scale, spacing grid, and component specimens defined above. Then materialise the tokens for the project's stack:

- Emit CSS custom properties on `:root` (or `[data-theme]` for multi-theme) — one variable per token, grouped by category (colors, typography, spacing, border radius, shadows).
- If the project uses Tailwind, also emit a `tailwind.config.ts` `theme.extend` block. If it uses Style Dictionary, emit a `tokens.json`. Ask which format is preferred when context is ambiguous.

For a browseable visual reference (swatches, type-scale specimens, component gallery), render the `design-system` **html** variant on request — it is on-request only; the JSON token data above is the working default.

---

## Process

1. **Detect industry** — scan `package.json`, `README`, existing CSS, or ask the user directly.
2. **Select preset** — choose the matching row from the Industry Presets table above.
3. **Incorporate existing brand assets** — read any existing color variables, logo files, or brand guidelines (use `Read`, `Grep`, `Glob`).
4. **Generate token file** — write `src/styles/tokens.css` (or equivalent path) with the full `:root` block.
5. **Create component examples** — produce 2–3 small component snippets (button, card, input) that consume the new tokens, so the user can verify the system looks correct.

---

## Anti-Patterns to Avoid

- **No purple gradients** unless the brand explicitly requires them — they age quickly and clash with most palettes.
- **No Inter-only** without `system-ui, sans-serif` fallback — always include a system font stack.
- **No low-contrast hero text** — heading text on colored backgrounds must meet WCAG AA (4.5:1 for normal text, 3:1 for large).
- **No decorative-only animations** without `@media (prefers-reduced-motion: reduce)` guard.
- **No fixed `px` font sizes** — use `rem` so the system respects user browser preferences.
- **No magic numbers** — every value in a component must trace back to a token; inline `color: #3b82f6` is a code smell.

## Inputs from sibling skills

The industry-preset matrix below draws on:

- [`style-selection`](../style-selection/SKILL.md) for the named visual style.
- [`color-palette-design`](../color-palette-design/SKILL.md) for the role-based palette.
- [`typography-pairings`](../typography-pairings/SKILL.md) for display/body pairings.

Run those three first for bespoke systems; use the built-in industry presets below as a fallback.
