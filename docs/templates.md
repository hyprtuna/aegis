# Authoring Templates

A practical guide to the Aegis **templates surface** — how to add, annotate, and wire up reusable output skeletons.

## What the templates surface is

Templates are DRY output skeletons that agents fill in at runtime. Instead of every skill carrying its own copy of a PR writeup, a plan layout, or a code-review report, the skill references a shared template and the agent renders it with the current data.

There are three **families**, by output format:

- **HTML** — stakeholder deliverables (PR writeups, status reports, incident reports, design systems, diagrams).
- **Markdown** — prose artifacts (plans, specs, changelogs, tickets, decisions, and the prose siblings of deliverable kinds).
- **JSON** — machine-readable payloads (AskUserQuestion decision payloads, and the data siblings of deliverable kinds).

Every template file has a sibling **slot manifest** — `<name>.template.json` — that declares which slots the template exposes, their types, and which are required. The manifest is validated against [`manifest/schemas/template.schema.json`](../manifest/schemas/template.schema.json).

Templates are canonical content. They live only under `templates/` and ship to hosts from there — there is no per-host template folder (Iron Law 2).

## Multi-format kinds

A single output **kind** can ship in more than one format. `code-review`, for
example, ships an HTML stakeholder deliverable, a Markdown inline-review
skeleton, and a JSON machine-findings payload — all the same kind, three
artifacts. Conversely, a purely visual kind like `svg-illustrations` ships HTML
only, and a config-shaped kind like `feature-flags` ships HTML + JSON but no
Markdown.

Which formats a kind ships, and which one is its **default**, is not inferred
from the directory tree — it is declared in a single authoritative file: the
per-kind **format index** (below). On-disk coverage is **20 HTML +
14 Markdown + 16 JSON** bodies across the reference-gallery kinds; the format
choices follow the inventory cut (a Markdown sibling where the output
is prose-shaped, a JSON sibling where it is data-shaped — not all three for every
kind).

## The per-kind format index

[`manifest/template-index.json`](../manifest/template-index.json) is the
authoritative answer to "which formats does kind X ship, and which is the
default?" It maps each **kind** to a description, a `default` format, and a
`formats` object pointing each format at that kind's default body:

```json
"code-review": {
  "description": "Code-review writeup — severity-graded findings…",
  "default": "markdown",
  "formats": {
    "markdown": "templates/markdown/code-review/default.md",
    "html": "templates/html/code-review.html",
    "json": "templates/json/code-review/default.json"
  }
}
```

Two consumers read this index: the format-aware `${TEMPLATE}` resolver (it turns
a kind + format into a real body path) and the Q2 user-choice prompt (it offers
the user exactly the formats a kind actually ships). The index is validated by
[`manifest/schemas/template-index.schema.json`](../manifest/schemas/template-index.schema.json)
and by the `scripts/validate/template-index.mjs` rule (every indexed path
exists, every shipping body is indexed, and each kind's `default` format is
present).

> The index keys are **kinds**, and each format points at the kind's **default
> variant** body. Sibling variants (e.g. `markdown/plans/minimal.md`,
> `markdown/decisions/opencode.md`, the `project/` family) are resolved by skills
> directly, not through this index — they are not separate index entries.

## Querying the index (`scripts/template-query.mjs`)

`scripts/template-query.mjs` is a **maintainer-only** introspection helper
(Iron Law 1 — not a user CLI) that answers the three discovery questions over
`manifest/template-index.json` (and the per-kind sibling slot manifests for
slot queries). It reads only the existing contract and writes nothing; output is
JSON on stdout.

```bash
# Which kinds ship a JSON format?
node scripts/template-query.mjs --kinds-supporting json
#   → { "query":"kinds-supporting", "format":"json", "count":18, "kinds":[ … ] }

# What formats does a kind ship, and which is default?
node scripts/template-query.mjs --formats code-review
#   → { "kind":"code-review", "default":"markdown", "designOnly":false,
#       "formats":{ "markdown":"…", "html":"…", "json":"…" } }

# What slots does a kind's body declare? (default format unless --format given)
node scripts/template-query.mjs --slots research-report --format html
#   → { "kind":"research-report", "format":"html", "body":"…",
#       "slotCount":11, "slots":[ {key,type,required,description}, … ], "shape":{…} }

# Every kind with its default + available formats.
node scripts/template-query.mjs --list
```

Flags: `--kinds-supporting <html|markdown|json>`, `--formats <kind>`,
`--slots <kind> [--format <format>]`, `--list`, `--help`. Unknown kinds, unknown
formats, and a kind that does not ship the requested format all exit non-zero
with a stderr message — so the helper doubles as a cheap CI sanity check.

## Families and filename convention

| Family | Layout | Path |
|---|---|---|
| HTML | flat | `templates/html/<name>.html` |
| Markdown | nested by family | `templates/markdown/<family>/<variant>.md` |
| JSON | nested by family | `templates/json/<family>/<variant>.json` |

Rules:

- Names are kebab-case.
- HTML is flat and one-per-output-kind — there's no sensible "minimal" variant of a stakeholder doc.
- Markdown and JSON nest under a **family folder** because variants are common: `markdown/plans/default.md` and `markdown/plans/minimal.md`. Default variant is `default`; an optional terser one is `minimal`.
- **Every** template file has a sibling `<name>.template.json` in the same folder. For `templates/markdown/plans/default.md`, the manifest is `templates/markdown/plans/default.template.json`.

## Slot syntax per family

Slots are annotated in the template body using the family's native escape hatch, so the raw file stays valid in its own format.

**HTML** — an HTML comment immediately preceding the slotted element. Comments survive browser rendering with zero visual impact. Class hints can name an enum in an adjacent attribute.

```html
<!-- SLOT: title -->
<h1>...</h1>

<!-- SLOT: signoff (class enum: approved | requested-changes) -->
<div class="signoff requested-changes">...</div>
```

**Markdown** — mustache-lite. No logic, no loops. The agent renders arrays into text *before* substitution.

```markdown
# {{ slot.title }}

Status: {{ slot.status }}
```

> Static skeletons that use angle-bracket prose placeholders (`<plan title>`) rather than mustache slots are fine — they just declare an empty `slots: []` in the manifest.

**JSON** — literal placeholder strings prefixed with `__SLOT__`, which keeps the file parseable.

```json
{ "name": "__SLOT__name", "severity": "__SLOT__severity" }
```

## The slot manifest

The sibling `<name>.template.json` is validated against `manifest/schemas/template.schema.json`.

**Required top-level keys:** `kind` (always `"template"`), `name` (must match the template file basename), `family` (`html` | `markdown` | `json`), `version` (semver), `description`, `slots`.

`source` is optional but recommended (provenance, e.g. `"html-effectiveness:17-pr-writeup.html"` or `"hand-authored"`). `shape` is optional.

**`slots[]` item shape:**

| Field | Required | Notes |
|---|---|---|
| `key` | yes | Slot identifier as it appears in the template (e.g. `title`, `pr.number`, `changes[]`). |
| `type` | yes | `string` \| `number` \| `boolean` \| `array` \| `object`, or a named shape from `shape`. |
| `required` | no | Defaults to `true`. Set `false` for optional slots. |
| `description` | no | What the slot is for. |
| `enum` | no | Closed value set (e.g. `["high","medium","low"]`). |

**`shape`** (optional): named object/array definitions referenced from `slots[].type`, documenting the fields of a complex slot.

### Example — `templates/html/pr-writeup.template.json`

```json
{
  "kind": "template",
  "name": "pr-writeup",
  "family": "html",
  "version": "0.1.0",
  "source": "html-effectiveness:17-pr-writeup.html",
  "description": "Standalone HTML pull-request writeup for reviewers: TL;DR, motivation with before/after, a file-by-file tour with code, review-focus callouts, a test plan, and a staged rollout.",
  "slots": [
    { "key": "title", "type": "string", "description": "PR title; used in <title> and the h1." },
    { "key": "eyebrow", "type": "string", "required": false, "description": "Small overline label." },
    { "key": "pr.number", "type": "string", "description": "PR number woven into the h1." },
    { "key": "summary", "type": "string", "description": "One-paragraph TL;DR of the change." },
    { "key": "changes[]", "type": "change", "description": "One collapsible block per changed file." },
    { "key": "testPlan[]", "type": "testStep", "description": "Test-plan rows; add class 'done' when verified." }
  ],
  "shape": {
    "change[]": "{ file: string, badge: enum[new,mod,del], lines: string, why: string, code: string (optional) }",
    "testStep[]": "{ step: string, expectation: string, done: boolean }"
  }
}
```

## The format-aware `${TEMPLATE}` resolver

Skills reference a template inline with a `${TEMPLATE:...}` directive. The
resolver in `scripts/project.mjs` reads the format index and supports two forms:

- **`${TEMPLATE:<kind>}`** — resolves the kind's **default** format (the `default`
  field in the index). For `code-review` that is the Markdown body; for
  `implementation-plan` it is HTML.
- **`${TEMPLATE:<kind>:<format>}`** — resolves an **explicit** format for the
  kind, e.g. `${TEMPLATE:code-review:html}` or `${TEMPLATE:flowchart:json}`.

Both forms resolve through the index, so the body path is never hard-coded in a
skill. This is **backward-compatible** with the pre-index bare tokens
(`${TEMPLATE:plans}`, `${TEMPLATE:decisions}`, …) — those kinds are seeded in the
index to their existing `markdown/<family>/default.md` paths and resolve as the
kind's markdown default.

At projection time the directive is rewritten per host:

- **Codex** — the resolved template ships in the plugin tree and the directive
  becomes a **bundled-path reference** to that file. Codex's 8 KB skill cap means
  template bodies are never inlined.
- **A host whose skill bodies are transformed AND that ships templates** —
  default rule: **inline** the resolved body if it is **under 2 KB**, otherwise
  emit a **`Read(...)`** instruction pointing at the bundled template path. HTML
  and any large template always take the `Read(...)` path.
- **Cursor, Zed** — deferred (~v0.5.0). No skill primitive, so `${TEMPLATE:...}`
  falls back to a literal file-path reference in the rules file; the user opens
  it manually. Logged as a gap in `adapters/{cursor,zed}/projection.md`.

An **unknown kind or format fails loudly** — the projector errors rather than
emitting a dangling token, and `assertNoTemplateTokens` guards the projected
output against any surviving `${TEMPLATE...}` literal.

> The earlier limitation — resolution was markdown-only and wired for Codex only
> — is **resolved.** The resolver now handles all three formats via
> the index across the active hosts. Cursor + Zed remain a known gap (deferred to
> ~v0.5.0), documented in their adapter projection docs.

## User-chosen output format (Q2)

When a skill can emit a deliverable in more than one format, it asks the user up
front rather than guessing. The Q2 format question in
[`rules/user-choice-discipline.md`](../rules/user-choice-discipline.md) offers
**exactly the formats the chosen kind ships** per the format index — including
**HTML** — with the kind's `default` marked **(Recommended)**.

This replaced the older rigid "exactly three options: JSON / Markdown / Both"
contract. The option set is now data-driven: a kind shipping only HTML + JSON
offers two choices; a kind shipping all three offers three. The user picks, the
resolver fetches the matching body via `${TEMPLATE:<kind>:<format>}`, and the
agent fills the slots. See
[`rules/user-choice-example.md`](../rules/user-choice-example.md) for a conformant
payload.

## Interactive-template minimal-JS exception

The default rule for HTML templates is **zero `<script>`** — self-contained,
inline CSS, no JS, no network. Three inherently-interactive templates carve a
documented, named exception:

- `prototype-animation` — replayable animation/easing demo.
- `prototype-interaction` — interaction prototype (e.g. drag-to-reorder).
- `prompt-tuner` — editable prompt with a live-filled preview.

These three may carry **self-contained** JavaScript, bounded strictly: JS drives
the **demo behavior only**, with no external `src`/CDN, no network requests, and
no tracking — the file still opens standalone. Rendering an animation demo or a
prompt-tuner as a static husk would strip its reason to exist. The exception is
closed: the other 17 HTML templates remain zero-JS. No validator gates
`<script>` count today, so any future check must allow these three by name.

## How to add a new template

1. **Create the template file** under the correct family path, kebab-case name:
   - HTML: `templates/html/<name>.html` (self-contained — inline CSS, system fonts, no external `src`/`href`/CDN).
   - Markdown: `templates/markdown/<family>/<variant>.md`.
   - JSON: `templates/json/<family>/<variant>.json`.
2. **Annotate slots** in the body using the family's syntax (`<!-- SLOT: key -->`, `{{ slot.key }}`, or `__SLOT__key`).
3. **Author the sibling `<name>.template.json`** with all required keys. Set `version` to **`0.1.0`** for a first stable release. Declare every slot; mark optional ones `required: false`; use `shape` for complex slots.
4. **Register the kind in the format index** — add or extend the kind's entry in `manifest/template-index.json` so the new body's format points at it, and set the kind's `default` if this is the first format. The `template-index` validator rule fails if a shipping body is not indexed.
5. **For HTML, also update** the maintainer catalog at `.aegis/index/html-templates.md` with the new file's coverage status, and update the relevant `templates/<family>/README.md`.
6. **Validate:** `node scripts/validate-structure.mjs` and `node scripts/tests/render-templates.mjs`.

### Versioning (semver)

- **Major** — breaking slot change: a required slot added, removed, or renamed.
- **Minor** — additive optional slot.
- **Patch** — wording / content fix, no slot change.

First stable release ships at `0.1.0`. `1.0.0` is reserved for the contract-freeze milestone (v0.1.0).

## Template-authoritative model & the named-artifact rule

Producers reference templates; they do not duplicate them. The canonical contract
lives in `rules/templates.md`:

- **Template-authoritative.** `${TEMPLATE:<kind>}` substitutes the kind's `default`
  body verbatim (`${TEMPLATE:<kind>:<format>}` for an explicit format). The template
  owns layout, section order, and any taxonomy; the producer carries only the
  reference, never duplicated format prose. A literal `${TEMPLATE:<real-kind>}`
  token is substituted at **every** occurrence in a skill/agent body during
  projection, so place it only at the one intended output point — never inside
  prose describing it.
- **Named-artifact rule.** Any skill/agent emitting a named artifact MUST reference
  a template kind via `${TEMPLATE}` **or** carry a `// REASON:` note. Enforced
  warn-only by `NAMED_ARTIFACT_TEMPLATE` (see `docs/validators.md`), graduating to
  hard-fail later.

## Design-only kinds (`designOnly: true`)

Some kinds ship a body + index entry but have **no near-term producer** — no skill
or agent emits them. Rather than letting them masquerade as unwired producers, they
are flagged `designOnly: true` in `manifest/template-index.json` (a
schema-allowed flag). A design-only kind is an **expected orphan**: the
producer-coverage validators treat it as intentional and do not warn that it lacks
a producer.

The ten design-only kinds:

- **Pure-orphan visual kinds (8):** `slide-deck`, `triage-board`, `feature-flags`,
  `component-variants`, `prototype-animation`, `prototype-interaction`,
  `prompt-tuner`, `svg-illustrations` — design references with no producer planned.
- **Producerless report kinds (2):** `status-report` and `incident-report` — the
  surface audit confirmed no existing skill or agent emits either, and this pass does
  **not** mint net-new producers for them (out of scope). Flagged design-only until
  a real producer lands.

> **Discoverability.** These ten `designOnly` kinds are a real, browsable design
> gallery — every body ships on disk and is fillable by hand even without a
> workflow producer. Query them with `node scripts/template-query.mjs --list`
> or `--formats <kind>` (see "Querying the index" above); each also has a
> sibling `<name>.template.json` slot manifest so the shape is inspectable
> without opening the body.

### Other orphaned kinds (documented gaps, not `designOnly`)

Four kinds ship a body + index entry, are **not** flagged `designOnly`, and
still have no wired producer as of v0.1.1. Unlike the ten above, these are
gaps to close rather than intentional design references:

- **`flowchart`** — no natural producer skill exists yet; keep the template on
  disk, route it through the `${TEMPLATE}` mechanism once one is authored.
- **`feature-explainer`** — `learning` already emits `concept-explainer`; a
  second, feature-specific producer is a follow-up, not v0.1.1 scope.
- **`releases`** — the release checklist template; the actual release workflow
  is maintainer prose (see the root `AGENTS.md` release-workflow section), not
  a skill deliverable.
- **`prompts`** — a one-shot prompt skeleton with no workflow producer today.

Authoring new producer skills for these four is deferred (see the v0.1.1
release plan) to avoid surface-count churn; any producer that does get wired
must route the format choice through the runtime index→Read procedure in
`rules/user-choice-discipline.md`, not a new static mechanism.

## Validation

Two gates cover the templates surface:

- **`scripts/validate-structure.mjs`** checks that every file under
  `templates/{html,markdown,json}/**/*.{html,md,json}` has a sibling
  `<name>.template.json`, that each manifest validates against
  `template.schema.json`, that the format index is well-formed and every indexed
  path exists (and every shipping body is indexed), and that each family folder
  carries a `README.md` listing its children. Missing sibling manifest is a
  **hard error**.
- **`scripts/tests/render-templates.mjs`** is the render harness: it fills every
  body's slots from manifest examples, asserts all required slots are filled with
  no residual markers, and checks index kind×format coverage. A missing slot
  manifest is a **hard error** here too.

Run both before committing — each completes in well under 30 seconds:

```bash
node scripts/validate-structure.mjs
node scripts/tests/render-templates.mjs
```
