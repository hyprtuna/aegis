# Palette Reference

On-demand reference for palette patterns by style family, anti-patterns, output format, and final review checklist. The parent `SKILL.md` covers the construction workflow.

## Palette patterns by style family

| Style | Primary hue guidance | Background | Accent behaviour |
|---|---|---|---|
| Brutalist | Any saturated (hot pink #ff2d55, safety yellow #ffe000) | Off-white (#f5f5f0) or pure black | One accent, nothing else coloured |
| Soft UI | Muted pastel (rose, sage, lavender — low saturation) | Warm off-white (#f0f0f3) | Single metallic accent (soft gold ~#c9a96e) |
| Glassmorphism | Cool (blue #2563eb / violet #7c3aed) | Tinted dark (#0f172a with colour cast) | Frosted-white surface (rgba alpha 10–20%) |
| Minimalist / Editorial | Deep (forest #166534, burgundy #881337, navy #1e3a8a) | Off-white (#f8f7f4) | Single editorial accent — used sparingly |
| Material Design | Saturated primary from MD3 colour roles | Pure white (light) / #1c1b1f (dark) | Secondary role + tertiary role per MD3 |
| Flat Design | Bold saturated primary, secondary from complementary | Pure white or bold solid colour | Limited — 2-3 colours maximum |
| Memphis | Primary triad (red, yellow, blue) + black | White | Clashing is intentional — bold borders |
| Swiss / Editorial | One strong primary (often red or blue) | Pure white | Neutral dominates; primary used sparingly |
| Skeuomorphic | Warm material hues (wood, parchment, leather) | Textured off-white | Avoid — textures carry the depth |

## Anti-patterns

1. **Relying on `opacity` alone to convey disabled state.** Lower-contrast-via-alpha often fails WCAG; use an explicit `text-disabled` token with a defined lightness step.
2. **Hue-based signalling only.** Colour-blind users (8% of males) need a second cue — icon, label, pattern, or shape.
3. **More than 4 semantic states visible on one screen.** Error + warning + success + info + CTA simultaneously reads like a Christmas tree. Design content sequencing to reduce simultaneous semantic load.
4. **Colours outside the token set leaking into components.** Enforce with lint (e.g., stylelint `color-no-hex` scoped to component files). Every colour in a component should trace back to a CSS custom property or design token.
5. **Pure pitch-black (#000) dark mode canvas.** Use near-black; reserve `#000` for hero-block overlays.
6. **Semantic colours too close to the primary.** If your error red has the same hue as your primary brand red, states will be ambiguous. Ensure at least 20° hue separation between semantic colours and the primary.
7. **Not testing both modes in device-representative conditions.** A palette that looks fine in Chrome DevTools dark mode may fail under actual OLED deep-black rendering.

## Output format

Emit the palette as a table the next step (`aegis:design-system-generation`) can turn into tokens:

```
role           light-hex   dark-hex   contrast-vs-bg-light  contrast-vs-bg-dark
primary        #2563eb     #60a5fa    8.6:1                 5.2:1
secondary      #7c3aed     #a78bfa    5.9:1                 4.6:1
cta            #0f766e     #2dd4bf    6.1:1                 7.0:1
background     #ffffff     #0a0a0c    —                     —
surface        #f5f5f7     #18181c    1.1:1                 1.8:1
text-primary   #111114     #e6e6ea    17.9:1                15.2:1
text-secondary #4b5563     #a1a1aa    7.4:1                 7.1:1
border         #e5e7eb     rgba(255,255,255,0.10)   1.2:1  —
success        #16a34a     #22c55e    4.7:1                 5.5:1
warning        #d97706     #fbbf24    4.6:1                 10.8:1
error          #dc2626     #f87171    5.4:1                 5.3:1
info           #2563eb     #60a5fa    8.6:1                 5.2:1
```

Follow the table with a brief human-readable note on any roles that required adjustment for WCAG compliance.

## Palette review checklist

Before handing off the palette:

- [ ] Every `text-*` token ≥ 4.5:1 on its container (light and dark).
- [ ] `cta` ≥ 4.5:1 for label text, on both `background` and `surface`.
- [ ] `border` for state-bearing use (focus ring, error border) ≥ 3:1.
- [ ] `success`, `warning`, `error`, `info` each ≥ 4.5:1 for label text.
- [ ] No semantic colour shares a hue within 20° of the `primary` (unless intentional + documented).
- [ ] Disabled state uses explicit token, not raw `opacity: 0.5`.
- [ ] Dark mode palette re-verified independently (not assumed from light-mode pass).
