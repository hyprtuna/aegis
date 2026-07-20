# Landing-Page Patterns and Universal Anti-Patterns

On-demand reference: landing-page section patterns (works with any style) and the 12 universal anti-patterns that apply regardless of style family.

## Landing-page section patterns

Use with any style. Pattern = the sequencing and shape of sections.

| Pattern | Section sequence | Best with |
|---|---|---|
| Hero-centric + social proof | Hero → logos → features → testimonials → CTA | Consumer B2C SaaS, consumer apps |
| Features grid | Hero → 4–6 features → CTA | Dev tools, API-first products |
| Story-driven | Hero → narrative sections → single CTA at end | Agencies, editorial, premium brands |
| Product-first | Screenshots on fold → short copy → CTA → features below fold | Dashboards, visual products |
| Pricing-first | Hero → pricing → FAQ → CTA | Transparent SaaS, self-serve tools |
| Dashboard showcase | Stats strip → product screenshot → integration logos → pricing | Analytics, B2B horizontal SaaS |

## Universal anti-patterns

These apply regardless of style family. Flag if any are present.

1. **Purple → pink gradient backgrounds.** AI-default. Unless the brand is literally a festival or lo-fi music app, don't.
2. **Inter-only typography.** "Just use Inter" looks generic. Pair it with a contrasting display face.
3. **Uniform corner radius everywhere (12–16px on every element).** Mix: hero cards can be 16–24px; inline chips 4px; buttons match the style (0px for Brutalist, 8–12px for Soft UI).
4. **Centered hero + 3 feature cards.** The universal SaaS template. Maximum genericness.
5. **Saturated gradient CTA buttons.** A solid single colour with a careful hover state reads more premium.
6. **Drop shadow on everything.** Shadows should be scarce and intentional; overuse reduces perceived quality.
7. **Dark mode as the only mode.** Dark-first is fine; dark-only is usually laziness unless the product is inherently dark-context (media player, IDE).
8. **No empty / error / loading states.** The three states every component skips. Each is a product moment.
9. **Hover-only interactions on touch platforms.** Tap-equivalents required for every hover-state affordance.
10. **Motion without `prefers-reduced-motion` support.** One line of CSS; no excuse.
11. **Stock image hero with overlaid text at low contrast.** Especially dark images with dark overlay + white text that fails AA.
12. **Identical primary and secondary button styles.** If secondary looks the same as primary, the hierarchy is broken.
