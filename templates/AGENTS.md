# templates — Agent Guidance

## Purpose

`templates/` holds reusable output skeletons agents fill in. Markdown for prose, JSON for machine-readable, HTML for stakeholder deliverables.

## Layout

Three families. HTML is flat (one file per output kind); Markdown and JSON nest
under a family folder because variants are common. Every body has a sibling
`<name>.template.json` slot manifest in the same folder. Each family folder
carries a `README.md` listing its shipping children.

```
templates/
├── html/                         # 22 self-contained HTML deliverables (20 gallery + 2 producer-backed; one file per kind)
│   ├── README.md
│   ├── code-approaches.html      # + .template.json sibling
│   ├── code-review.html
│   ├── … (20 total — see html/README.md)
│   └── visual-exploration.html
├── markdown/                     # prose/doc skeletons, nested by family
│   ├── README.md
│   ├── plans/{default,minimal}.md
│   ├── specs/{default,minimal}.md
│   ├── decisions/{default,opencode}.md
│   ├── changelogs/default.md · releases/default.md · tickets/default.md · prompts/default.md
│   ├── project/{agents-md,claude-md,tasks}.md
│   └── <kind>/default.md         # MD siblings of the deliverable kinds (code-review, status-report, …)
└── json/                         # data-shaped skeletons, nested by family
    ├── README.md
    ├── decisions/claude-code.json
    └── <kind>/default.json        # JSON siblings of the deliverable kinds (code-review, triage-board, …)
```

The authoritative per-kind format map (which formats a kind ships and its
default) is `manifest/template-index.json`, not this tree. See `docs/templates.md`.

## Frontmatter

Templates use minimal frontmatter:

```yaml
---
name: stable-kebab-slug
description: One-line description.
visibility: internal
platforms: [claude, opencode, codex, cursor, zed]
---
```

Some templates (notably HTML) may have no frontmatter at all — they are pure output skeletons.

Note the asymmetry: a template *body*'s YAML frontmatter carries no `kind:` (the key is retired
across markdown surfaces), but the sibling `<name>.template.json` slot manifest still requires
`"kind": "template"` — there it is a live schema discriminator validated by
`manifest/schemas/template.schema.json`, not a redundant restatement of the directory.

## Slot-declaration convention

Every body has a sibling `<name>.template.json` whose `slots[]` and optional
`shape` must correspond **1:1** with the body's markers. The slot↔body gate
(`scripts/validate/template-index.mjs`) and the render harness
(`scripts/tests/render-templates.mjs`) enforce full-path correspondence, so the
declaration rules below are mandatory, not advisory.

**One base per collection.** An array (repeating) slot is declared `<base>[]`.
Its nested fields are declared as explicit slot keys `<base>.<field>` (or
`<base>.<field>[]` for a nested array). If a `shape` entry documents that
collection, it is keyed `<base>[]` — the **same base** as the array slot and as
the body markers. The array slot, its field slot keys, its `shape` key, and its
body markers all share one `<base>`.

**Body markers, by family:**

- HTML — `<!-- SLOT: <base> -->` is the repeat anchor; `<!-- SLOT: <base>.<field> -->`
  fills a field. (The shared SLOT-key regex lives in `scripts/validate/_context.mjs`;
  the key class includes `-`, so hyphenated keys are captured identically by the
  gate and the render harness.)
- Markdown — `{{ slot.<base> }}` / `{{ slot.<base>.<field> }}` (the bare `{{ <base> }}`
  form is also accepted).
- JSON — the **flattened-field exception.** JSON bodies do not use dotted/repeat
  markers; a collection flattens into camelCase scalar slots (`finding[]` with a
  `severity` field → slot/marker `findingSeverity`). JSON `shape` keys are
  therefore **documentary** — they describe the logical array a producer
  assembles and are exempt from the "shape array must appear in the body" rule.
  They are still subject to the full-path orphan rule (every JSON marker must be
  a declared slot key).

**What the gate enforces (HTML/MD):**

1. Forward — every declared slot key appears in the body. An array slot `<base>[]`
   is satisfied by a `<base>` marker OR any `<base>.<field>` marker; a scalar/dotted
   slot key must match a marker exactly.
2. Orphan — every body marker matches a declared slot key by full path, OR is a
   field of a declared collection (`<base>[]` slot or `<base>[]` shape). A bogus
   sub-path of a scalar slot (`{{ slot.title.headline }}` when only the scalar
   `title` is declared) is an **error**.
3. Shape arrays required — every `shape` array `<base>[]` must be wired into the
   body (a `<base>` marker base exists) or nested inside another shape value
   (e.g. `item[]` referenced as `items: item[]` inside `column[]`).

**Worked example** (`templates/html/code-understanding.template.json`, reconciling
the historical `phases[]`/`phase[]`-style clash by sharing one base):

```json
"slots": [
  { "key": "callSequence[]",            "type": "step",   "description": "Ordered call steps." },
  { "key": "callSequence.location",     "type": "string", "description": "File:line for the step." },
  { "key": "callSequence.description",  "type": "string", "description": "What runs here." }
],
"shape": {
  "callSequence[]": "{ location: string, description: string, code: string (optional) }"
}
```

Body (HTML):

```html
<!-- SLOT: callSequence (repeat one .step per call step) -->
<!-- SLOT: callSequence.location -->
<!-- SLOT: callSequence.description -->
```

The array slot `callSequence[]`, the field slots `callSequence.location` /
`callSequence.description`, the `shape` key `callSequence[]`, and every body
marker all share the base `callSequence`. (Before this convention, the `shape` key was
the element **type** name `step[]`, which did not match the body — that
divergence is the historical clash this convention closes; migrated manifests
now key `shape` by the collection base, not the type name.)

**Accepted variations + known gate limitations (honest gaps):**

- **Plural-anchor / singular-element collections.** Some HTML manifests declare the
  array slot with a plural base and its element fields with the singular (`changes[]`
  repeat anchor + `change.file`/`change.badge` fields + `shape` key `change[]`). The
  gate accepts this because `collectionBases` is the **union** of array-slot bases and
  shape-array bases, so both `changes` and `change` are valid collection bases. This is
  a legitimate, natural pattern (`changes` is the array; `change` is one element) — but
  the gate does **not** cross-verify that a plural slot base and a singular shape base
  name the *same* collection. A future manifest pairing an array slot `foo[]` with an
  unrelated shape `bar[]` would pass. Tightening to enforce the pairing requires
  brittle pluralization logic; recorded as a known limitation rather than enforced.
- **JSON: two sanctioned styles.** Most JSON manifests use the flattened-field form
  above. A few (`json/triage-board`, `json/flowchart`) instead use a **single-anchor
  exemplar**: one scalar slot stands in for a whole collection and is repeated across
  the element's fields in the body skeleton (the producer expands it). Both are valid;
  the JSON `shape`-array exemption (above) covers both. The flattened-field form is
  preferred for new JSON kinds.
- **HTML marker syntax.** A `<!-- SLOT: key -->` marker MUST have whitespace before the
  closing `-->`. The shared SLOT-key regex includes `-` (for hyphenated keys), so a
  space-less `<!-- SLOT: key-->` would capture `key--` and mis-match. Every shipped
  body follows the space convention; new HTML bodies must too.

## HTML Constraints

- Self-contained: no external `src=`, `href=`, `@import`, CDN.
- All CSS inline in a `<style>` block.
- System font stacks only.
- Static documents: zero `<script>` tags (default).
- Use content slots — agents fill slots, not full HTML.
- Accessible: semantic landmarks/sectioning, WCAG AA contrast, keyboard-reachable
  interactive controls (the three interactive templates named below), and
  `aria-hidden`/decorative handling for purely-visual SVG. See the `ui-design`
  skill for the full a11y guidance — not duplicated here.

### Interactive-template exception

Exactly **three** templates carve a documented exception to the zero-JS rule:

- `prototype-animation.html`
- `prototype-interaction.html`
- `prompt-tuner.html`

These are inherently interactive demos — rendering them as static husks strips
their reason to exist. They may carry **self-contained** JavaScript, under a
strict bound: JS drives the **demo behavior only**, with no external `src`/CDN,
no network requests, and no tracking. The exception is named and closed — all
other HTML templates remain zero-JS. (No validator gates `<script>` count
today; this is a doc constraint plus a note for any future check, which must
allow these three by name.)

### UX patterns

HTML deliverable templates apply a consistent UX pattern set (added once
real producers existed for them):

- **Scroll-margin anchors** — each `<h2>` section carries an `id` + `scroll-margin-top`
  so in-page links land cleanly below any sticky header.
- **`<details>` collapsibles** — long or secondary content (extended tables,
  validation evidence, ordering issues) is wrapped in `<details>` so the deliverable
  opens scannable and expands on demand.
- **Accent borders** — `border-left: 4px solid var(--accent)` marks callout/summary
  blocks.
- **Eyebrow + subtitle** — headers carry a small overline label + a one-line subtitle.

The render harness (`scripts/tests/render-templates.mjs`, Pass 3) asserts these markers
render on the producer-backed templates and that no residual `<!-- SLOT: -->` markers
remain. All patterns stay within the zero-JS / self-contained constraints above.

## Coverage

HTML template coverage tracked in `.aegis/index/html-templates.md`. Started at 3 →
grew to **full 20/20** (all reference kinds on disk), plus 14 Markdown + 16 JSON
siblings per the inventory cut. A later pass added two producer-backed kinds
outside the reference gallery (`plan-audit-report`, `research-report`), each with
MD + JSON + HTML siblings → 22 HTML / 16 MD / 18 JSON bodies on disk.
