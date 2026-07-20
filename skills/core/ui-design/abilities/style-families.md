# Style Selection

**Pair with:** the `ui-design` parent skill (audit output), `design-systems.md` (industry presets), `color.md`, `typography.md`.

## When to use

- Starting a new UI from zero and the user gave no visual reference.
- The user named an industry but no visual direction ("a fintech dashboard", "a wellness booking app").
- The current design feels generic — "AI default" purple gradients, Inter-only, centered hero with 3 feature cards. A named style breaks out.
- The product exists but needs a redesign; you need a shared vocabulary for the direction.

## Decision flow

1. **What industry?** Use the industry → style mapping table below to get a shortlist (default + also-consider).
2. **What audience?** Consumer vs. enterprise vs. development shifts the shortlist (see audience modifiers).
3. **What is the primary job?** Data-dense reads (dashboards) → Flat / Swiss / Material. Emotional purchase (fashion) → Editorial / Soft UI. Utility (SaaS tools) → Minimalist / Flat.
4. **Confirm with the user.** Show 2-3 candidate names. Get explicit sign-off before building.

## Style families

See `style-families/style-families.md` for the full catalog of the 10 named styles (Brutalist, Soft UI, Glassmorphism, Skeuomorphic, Neumorphism, Material, Flat, Memphis, Editorial/Swiss, Minimalist) with keywords, best-fit industries, color/typography mood, effects, anti-pattern warnings, and accessibility notes per style.

---

## Industry → style mapping

| Industry | Default style | Also consider | Avoid |
|---|---|---|---|
| SaaS (horizontal / general) | Minimalist, Flat | Swiss / Editorial | Cyberpunk, Memphis |
| SaaS (development tools) | Brutalist, Swiss / Editorial | Glassmorphism | Soft UI, Skeuomorphic |
| Fintech | Minimalist, Swiss | Material | Brutalist, Memphis, Glassmorphism |
| Healthcare | Minimalist, Flat | Soft UI | Brutalist, Memphis, Neumorphism |
| Wellness / Beauty | Soft UI | Minimalist | Brutalist, Glassmorphism |
| E-commerce (luxury / fashion) | Editorial, Minimalist | Glassmorphism | Brutalist, Memphis |
| E-commerce (mass market) | Flat, Material | Brutalist (for brand differentiation) | Skeuomorphic |
| Gaming / Crypto | Brutalist | Glassmorphism | Soft UI, Minimalist |
| Education / EdTech | Flat, Material | Soft UI | Brutalist, Neumorphism |
| Developer Tools | Brutalist, Swiss / Editorial | Flat | Soft UI, Memphis |
| Editorial / Media | Editorial, Minimalist | Swiss | Neumorphism, Skeuomorphic |
| Gov / Public sector | Flat, Swiss | Material | Glassmorphism, Brutalist |
| Mental health / meditation | Soft UI | Minimalist | Brutalist, Memphis |
| Audio / Music tools | Skeuomorphic (controls only) | Flat | Memphis |
| Gen-Z consumer brand | Memphis | Brutalist | Corporate Minimalist |

## Audience modifiers

Apply after the industry table:

| Audience | Modifier |
|---|---|
| Developer / technical | +Brutalist, +Swiss. −Soft UI, −Skeuomorphic |
| Enterprise / B2B | +Flat, +Material, +Swiss. −Brutalist, −Memphis |
| Consumer / B2C | +Soft UI, +Editorial. Wider range acceptable |
| Luxury / premium | +Minimalist, +Editorial, +Glassmorphism (sparingly). −Flat, −Memphis |
| Accessibility-first | +Flat, +Swiss, +Material. −Glassmorphism, −Neumorphism |

## Landing-page patterns and universal anti-patterns

See `style-families/landing-patterns-and-anti-patterns.md` for the 6 landing-page section patterns (hero-centric, features grid, story-driven, product-first, pricing-first, dashboard showcase) and the 12 universal anti-patterns that apply regardless of style family.

## Output format

When this skill resolves a style, emit:

```
Style family: [name]
Rationale: [1-2 sentences linking industry, audience, and product job]
Palette mood: [1 sentence — feed to color.md]
Typography mood: [1 sentence — feed to typography.md]
Avoid list: [2-3 specifics]
```

## See also

- `color.md` — how to choose the colour ramp that fits the style.
- `typography.md` — concrete display/body pairings per industry and mood.
- `ux-reasoning.md` — 25 high-leverage UX rules; apply as a checklist after building.
- the `ui-design` parent skill — 6-pillar audit (run after the system is built).
- `design-systems.md` — produces the tokens + component primitives for the chosen style.
