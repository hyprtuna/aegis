# Typography Pairings

**Pair with:** `style-families.md` (constrains mood), `color.md` (contrast ratios), `design-systems.md` (emits tokens).

## When to use

- You have a style and a palette but no typography decision yet.
- The current design uses Inter for everything and looks generic.
- You need an editorial display face paired with a readable body face.
- Refactoring font choices into a type scale token system.

## Decision flow

1. **What style family?** (From `style-families.md`.) Each family has a preferred typography mood.
2. **What is the primary job?** Reading-heavy → serif or humanist. Interface-primary → geometric sans. Data-dense → neutral sans.
3. **What is the licensing context?** Paid fonts (Söhne, Canela) vs. Google Fonts (free, web-safe) vs. system fonts.
4. **Pick a scale ratio.** One scale, applied uniformly. No ad-hoc sizes.

## Pairings by industry

See `typography/industry-pairings.md` for the 11 industry-specific display/body pairings (SaaS, Fintech, Editorial, Wellness, E-commerce ×2, Healthcare, Gaming/Crypto, EdTech, Agencies), each with mood notes, body-size baselines, and Google Fonts links.

---

## Modular scale

Pick ONE scale and apply it uniformly. Never mix ad-hoc sizes.

| Scale name | Ratio | Character |
|---|---|---|
| Minor second | 1.067 | Ultra-tight, dense dashboards |
| Minor third | 1.200 | Tight, data-heavy tables |
| Major third | 1.250 | Default SaaS / UI applications |
| Perfect fourth | 1.333 | Content-forward, blogs, docs |
| Augmented fourth | 1.414 | Editorial pages |
| Perfect fifth | 1.500 | Big expressive hero-heavy layouts |
| Golden ratio | 1.618 | Maximum drama; hero-only |

Derive sizes from a base (16px). Example with major third (1.250):

```
  11px    12px    14px   16px   20px   25px   31px   39px   49px   61px
  –4      –3      –2     base   +1     +2     +3     +4     +5     +6
```

Use tokens for every stop. No intermediate ad-hoc values.

## Style family → typography mood mapping

| Style family | Display mood | Body mood | Scale suggestion |
|---|---|---|---|
| Brutalist | Monospace / chunky sans | Monospace or condensed | Minor third |
| Soft UI | Elegant serif (fragile at small sizes) | Humanist sans | Major third |
| Glassmorphism | Geometric sans, heavy weight | Geometric sans | Major third |
| Minimalist / Editorial | Strong serif | Clean sans | Perfect fourth or Augmented fourth |
| Material Design | Brand sans or Roboto | Roboto / brand sans | Major third (MD3 type scale) |
| Flat Design | Bold sans | Neutral sans | Major third |
| Memphis | Display slab or condensed sans | Geometric sans | Minor second (tight) |
| Swiss / Editorial | Helvetica-adjacent sans | Neutral sans | Minor third |
| Skeuomorphic | Humanist serif | Humanist sans | Major third |

## Weight pairing rules

**Display / heading faces:**
- 500 Medium — subdued headings, secondary sections.
- 600 Semibold — standard headings, card titles.
- 700 Bold — primary headings, hero text.
- 900 Black — hero-only, one usage max per view. Never in body.

**Body faces:**
- 300 Light — avoid below 18pt and on textured backgrounds.
- 400 Regular — body copy.
- 500 Medium — UI labels, table headers.
- 600 Semibold — emphasis within body, inline highlight.

**Rules:**
1. Do not use Light (300) for any text below 18pt.
2. Use Medium (500) for all CTA button labels regardless of size.
3. Reserve Black (900) for single-word hero treatments or logos only.
4. Heading weight should create clear contrast with body weight. 400/600 is a safe pair. 400/400 (different size only) requires very large size difference.

## Anti-patterns

1. **Inter-only.** The universal AI default. Fine in development tooling; generic everywhere else. Always pair with a distinct display face.
2. **More than two font families.** Display + body is the rule. A third family is almost always a smell; remove it unless it's monospace for code specifically.
3. **Body copy below 16px on desktop or 15px on mobile.** Slightly higher for healthcare (17px) and long-form reading (17–18px).
4. **Ultra-light weights (100, 200) for any text over a patterned or photographic background.** Fails contrast under real-world conditions.
5. **Over-tight letter-spacing on small sizes.** Tracking should loosen as font-size shrinks (negative tracking is for large display only).
6. **All-caps for paragraphs.** All-caps acceptable for labels and short UI text only (max 4–5 words). Never for running text.
7. **Justified text in narrow columns.** Creates rivers. Left-aligned for columns under 45 characters. Justify only for very wide layouts with a hyphenation library.
8. **Mixing serif display + serif body from different style families.** Two serifs with different personalities (slab + old-style) fight each other. If using a serif body, pick a body-optimised cut (Lora, Freight Text) and a separate display cut.
9. **System font stack as a permanent choice.** Fine for prototyping; signals unfinished product in real products unless the brand intentionally targets a utilitarian aesthetic.

## Output format

Emit the decision as a token set the next step can consume:

```
family.display  : "Canela" (or "Playfair Display" for free tier)
family.body     : "Inter"
family.mono     : "JetBrains Mono" (include if product has code display)
scale.ratio     : 1.25
size.base       : 16
weight.body     : 400
weight.label    : 500
weight.heading  : 600
weight.display  : 700
line-height.body: 1.6
letter-spacing.display: -0.02em
```

## See also

- `style-families.md` — style constrains typography mood; resolve style first.
- `color.md` — pair with the chosen contrast ratios to verify text legibility.
- `design-systems.md` — emits tokens + component defaults from this output.
- `ux-reasoning.md` — rule §16 (touch target sizing affects font-size decisions on mobile).
