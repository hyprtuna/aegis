---
name: color-palette-design
description: 'Use when constructing a role-based colour palette — meets WCAG AA, derives a dark-mode variant. Pairs with style-selection and design-system-generation.'
user-invocable: false
---

> **Invoke via `Skill({skill: "aegis:color-palette-design"})`.** This is a skill, not an agent. If you reached for the Agent tool, you're using the wrong primitive.

# color-palette-design

**Pair with:** `aegis:style-selection` (defines mood), `aegis:design-system-generation` (consumes the output as tokens), `aegis:ux-reasoning-rules` (contrast rules §18).

## When to use

- You have a named style (from `aegis:style-selection`) but no colour values yet.
- You have an existing palette that fails contrast or doesn't cover all semantic roles.
- You need a dark-mode variant of an existing light-mode palette.
- Refactoring magic hex values out of components into a token system.

## Role-based structure

Every system defines at least these roles. Never skip one — "we don't need a warning colour" becomes "why is there yellow everywhere?" the moment a warning state ships.

| Role | Purpose | WCAG AA requirement |
|---|---|---|
| `primary` | Brand anchor. Headlines, key icons, active states. | ≥ 4.5:1 on background (text use); ≥ 3:1 (UI component) |
| `secondary` | Subordinate brand surface: chips, inactive tabs, secondary nav. | ≥ 3:1 (UI element) |
| `cta` | Call-to-action buttons. One colour. Must stand out from `primary`. | ≥ 4.5:1 for label text on button |
| `background` | Page / canvas. | Measured against text — not rated alone. |
| `surface` | Cards / panels on top of background. | ≥ 1.5:1 vs background for visual separation |
| `text-primary` | Body copy and headings. | ≥ 4.5:1 vs background (AA normal text) |
| `text-secondary` | Captions, helper text, placeholders. | ≥ 4.5:1 vs background |
| `border` | Subtle separators; state-bearing borders (focus, error). | ≥ 3:1 vs adjacent colour for state-bearing use |
| `success` | Positive state: confirmation, completion. | ≥ 4.5:1 for any label text on tinted background |
| `warning` | Advisory state: caution, pending action. | ≥ 4.5:1 |
| `error` | Destructive or failed state. | ≥ 4.5:1 |
| `info` | Neutral notification or help. | ≥ 4.5:1 |

**Contrast reference (WCAG 2.1 AA):**
- Normal text (< 18pt or < 14pt bold): 4.5:1
- Large text (≥ 18pt or ≥ 14pt bold): 3.0:1
- UI components and graphical objects: 3.0:1

Tool recommendation: verify with `culori`, `chroma-js`, or the Chrome DevTools contrast checker. Eyeballing is not sufficient.

## Construction process

Work through these steps in order. Skipping steps introduces inconsistency.

### Step 1 — Anchor the primary

Take the brand colour or pick a hue that matches the style mood (see `aegis:style-selection` palette mood). Note:
- **HSL triplet** — you will mutate S and L, never the H (except small adjustments for harmony).
- **Hue family** — warm (red/orange/yellow), cool (blue/green), neutral (low-saturation).

### Step 2 — Pick the CTA

CTA can equal primary but often works better as a complementary or split-complementary accent. Rules:
- CTA must be visually distinct from primary at first glance.
- CTA must meet 4.5:1 vs both `background` AND `surface` (it appears on both).
- One CTA colour. Two CTA colours create confusion about hierarchy.

### Step 3 — Derive the neutral ramp

Generate a 10-stop neutral scale from near-white (50) to near-black (950). Steps:
1. Start with pure HSL(0, 0%, L%) grey at each stop.
2. Shift hue by 2–6° toward the primary's hue family (warm primaries → slightly warm neutrals).
3. Pure grey next to a coloured primary looks dusty or sterile — the hue shift makes neutrals feel cohesive.
4. Name the stops: 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950.

### Step 4 — Pick semantic colours

- **Success:** Green family. Rotate the hue 5–10° toward the primary's hue to harmonise. Don't fully override with the primary hue.
- **Warning:** Amber/yellow. Keep it clearly distinct from primary if primary is orange.
- **Error:** Red. ≥ hue 0–10°. Do not use magenta or hot pink as "error" — they read as brand, not danger.
- **Info:** Blue if primary is not blue; otherwise use a cool neutral blue or teal to differentiate from primary.

### Step 5 — Verify contrast

For every text/icon that will sit on a coloured surface:
1. Calculate contrast ratio (foreground vs. background).
2. Check against the requirement table above.
3. If failing: increase the lightness gap, not just saturation. Saturation alone does not reliably increase contrast.

### Step 6 — Derive dark mode

See the "Dark-mode derivation" section below.

## Dark-mode derivation

Dark mode is **not** inverted light mode. Inversion produces wrong hue shifts and eye-straining contrast. Follow this process:

1. **Keep the hue** of primary / CTA. Drop saturation by 10–20%. Increase lightness of primary if it was dark (target: >50% relative luminance in dark mode so it stays readable against a dark canvas).
2. **Choose a dark canvas** — not pure black. `#0a0a0c` or `#111114` or `#16161a` reads richer than `#000000`. Reserve pitch-black for full-bleed hero blocks.
3. **Surface layer** is a few luminance steps above canvas: canvas = `#0a0a0c`, surface = `#18181c`. No more than 3–4 luminance steps between canvas and surface. Overly bright cards in dark mode defeat the purpose.
4. **Text primary:** off-white `#e6e6ea` or `#f0f0f4`, not pure `#ffffff`. Pure white on dark background fatigues the eye in extended sessions.
5. **Borders in dark mode:** alpha-white (rgba(255,255,255,0.08–0.14)) rather than a new solid token. This inherits the surface hue naturally.
6. **Re-check every contrast pair.** Light-mode passes do not transfer automatically to dark mode.

## Palette reference (style families, anti-patterns, output, checklist)

See `abilities/palette-reference.md` for the style-family palette table, the seven anti-patterns to avoid, the canonical output-table format consumed by `design-system-generation`, and the final review checklist.

## See also

- `aegis:style-selection` — choose the visual style first; it constrains the palette mood and background treatment.
- `aegis:design-system-generation` — consumes this palette output as design tokens.
- `aegis:ui-design` — pillar 3 (colour) verifies the finished system against these ratios.
- `aegis:ux-reasoning-rules` — rules §6 (visual hierarchy via colour), §18 (focus ring contrast), §25 (single-source tokens).
