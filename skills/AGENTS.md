# skills — Agent Guidance

## Purpose

`skills/` is Aegis's catalog of reusable capabilities. Every skill is a folder with `SKILL.md` plus optional `abilities/` fragments.

## Layout

```
skills/
└── core/<name>/            # the sole bucket — every registered skill lives here
    ├── SKILL.md            # required, lean (<100 lines) — the ONLY registered surface
    ├── REFERENCE.md        # optional — dense facts / data tables
    ├── EXAMPLES.md         # optional — worked transcripts
    └── abilities/<x>.md    # optional — on-demand fragments loaded by a pointer
        └── <group>/…       # optional — fragments may nest; the projector walks the tree
```

**One bucket.** `core/` is the only bucket. The former `workflows/` and `languages/` buckets were
dissolved into it; workflow-shaped skills sit alongside every other skill, and language practice
became fragments of `develop`. Buckets are discovered from the filesystem
(`scripts/lib/skill-scopes.mjs`), so nothing hardcodes the list — but adding a second bucket is a
structural decision, not a filing convenience.

**Fragments may nest.** `abilities/` is copied verbatim into every host tree *walking
subdirectories*, so a parent with many fragments may group them. `develop` is the worked
example: `abilities/languages/<lang>.md` is the per-language index, and its sibling
`abilities/languages/<lang>/` directory holds that language's practice files and a `rules/`
overlay. Nesting changes nothing about registration — the parent `SKILL.md` is still the only
registered surface (Iron Law 4).

## Frontmatter

```yaml
---
name: stable-kebab-slug
description: One-line trigger-style description.
visibility: user | internal
platforms: [claude, opencode, codex, cursor, zed]
---
```

## Chaining (prose, and only prose)

A skill that hands off to another says so **in its body**. There is no frontmatter field that routes
anything: `scripts/project.mjs` emits no `x-aegis` key to any host, and Aegis has no runtime. The
model reads the body, sees the successor named, and invokes it — or does not.

The `x-aegis.pipeline` block that used to declare chains has been **removed**. It validated the
wrong artifact: the projector stripped it, so a skill could declare `next: foo`, never mention foo in
its body, and pass validation while chaining nothing. Do not reintroduce it.

Write transitions with one of two markers:

```markdown
## REQUIRED SUB-SKILL: implementation-planner

After the user approves the spec, the next step is `aegis:implementation-planner`. …
```

```markdown
**REQUIRED SUB-SKILL:** use `aegis:test-driven-development` to write that test. …

**REQUIRED BACKGROUND:** this skill consumes review findings, so it presupposes a
completed review — normally `aegis:code-review`. …
```

- **REQUIRED SUB-SKILL** — a *transition*: finish here, go there next. These form the chain graph.
- **REQUIRED BACKGROUND** — a *prerequisite*: understand that skill first. Not a forward step, so
  naming an upstream skill this way is correct and is not a cycle.

Never force-load a successor with an `@`-style directive — that spends context on a skill the task
may never reach. Name it and let the model invoke it.

Rules (enforced by the `COMPOSITION` validator, `scripts/validate/composition.mjs`, which parses
these markers out of skill **bodies**):

- **Real skills.** Every name in a marker MUST name a skill that **exists in canonical** under its
  **current** name (no phase-label aliases, no renamed-away names). A stale name sends the model
  after a skill that no longer registers.
- **Acyclic.** The graph built from REQUIRED SUB-SKILL edges must have no cycle (the validator
  reports the cycle path).

Warn-only, so a stale edge does not fail the build — read the warnings. See
`docs/workflow-guide.md` → *Chaining is prose, and only prose* for the shipped spine.

## Intensity levels (`x-aegis.intensity`)

A skill may dial its effort with three intensity levels — `lite`, `full`, `ultra`. This is an
**optional extension of the same `x-aegis` composition namespace** — a sibling of
`pipeline`, **not** a parallel top-level field. It is fully **optional**: a skill that declares no
`intensity` block behaves **exactly as today** — `full` is the implicit default.

```yaml
x-aegis:
  intensity:
    default: full              # the level used when the caller names none
    levels: [lite, full, ultra]
```

- **`default`** — one of `{lite, full, ultra}`; the level applied when the caller names none. When
  the whole `intensity` block is absent, the implicit default is `full`.
- **`levels`** — the levels this skill implements. Each declared level MUST have a matching branch in
  the body.

**How a skill body branches per level.** A skill with an `intensity` block carries one
`### Intensity: <level>` heading per declared level. The shared body above the branches runs for every
level; the branch adds (`ultra`) or trims (`lite`) on top of it:

```markdown
### Intensity: lite
Trim to the high-value core — the single most important pass; skip optional deepening.

### Intensity: full
The baseline behavior — lossless versus the skill's default. Run every documented step.

### Intensity: ultra
Deepen — extra passes, adversarial cross-checks, wider coverage, more evidence.
```

**Losslessness rule.** `full` MUST be lossless versus the skill's pre-intensity behavior — adding an
`intensity` block must not remove anything a `full` run did before. `lite` trims effort; `ultra`
deepens. The caller selects a level (e.g. `code-review --ultra`); absent a selection, `default` (or
implicit `full`) applies.

Rules (checked by the `COMPOSITION` validator when an `intensity` block is present — warn-only, no
false positives for skills that declare none):

- **Known set.** Every `levels` entry and `default` MUST be one of `{lite, full, ultra}`.
- **Default in levels.** `default` MUST be one of the declared `levels`.
- **Branch presence.** Each declared level MUST have a `### Intensity: <level>` branch in the body.

**`x-claude.primitiveHint` (Claude-only authoring hint).** A skill whose Claude projection should open with the primitive-disambiguation blockquote carries `primitiveHint: skill` under its `x-claude:` block. The projector reads it to RE-INJECT `> **Invoke via \`Skill({skill: "aegis:<name>"})\`.** This is a skill, not an agent. …` at the top of the generated Claude body (`adapters/claude/skills/.../SKILL.md`). Canonical bodies stay host-neutral — they do NOT carry the blockquote. `primitiveHint` is **consumed-not-emitted**: it never appears in generated Claude frontmatter, and OpenCode/Codex/Cursor/Zed bodies get no blockquote. Merge it alongside any existing `x-claude` keys (e.g. `agent:`, `argument-hint:`).

## Workflow skills are phase-ordered and gated

A workflow is not a separate bucket or surface — it is a *shape* a skill in `skills/core/` can take:
a **phase-ordered, gated chain** where each phase gates on the prior (it may not start until the
predecessor's hand-off artifact exists) and the transition names its successor. Document the phase
order and its hand-off artifacts in the body's prose, and mark each transition with a REQUIRED
SUB-SKILL marker per the section above. A workflow whose phases are all internal (no hand-off to a
separate named skill) documents its order in prose and simply carries no marker.

See `docs/workflow-guide.md` → *The phase-ordered gated-workflow convention* for the full convention,
its forward-on-pass / back-on-fail gate rule, and the superpowers / get-shit-done source pattern.

## Tiered layout (progressive disclosure)

A skill folder may carry up to four tiers, each holding a different weight of material:

- **`SKILL.md`** — required, lean, the entry point. The ONLY registered surface.
- **`REFERENCE.md`** — optional, dense facts / data tables consulted on demand.
- **`EXAMPLES.md`** — optional, worked transcripts.
- **`abilities/<x>.md`** — optional, on-demand fragments loaded by a pointer.

This maps onto the **progressive-disclosure ladder** (in-skill step → in-skill reference →
external reference reached by a context pointer): the full vocabulary — leading words, completion
criteria, the ladder itself, and the sediment / no-op / premature-completion failure modes — lives
in exactly one place, `skills/core/skill-creation/abilities/authoring-doctrine.md`; read it rather
than restating it here.

**Iron Law 4 applies to every overflow tier.** The parent `SKILL.md` is the only registered skill;
`REFERENCE.md`, `EXAMPLES.md`, and `abilities/*` carry no 4-field frontmatter and are never
independently invoked.

**Validator consistency (mechanical enforcement).** `SKILL_SIZE` (`scripts/validate/skill-size.mjs`,
warn-only) flags a `SKILL.md` body over 100 lines and scans `SKILL.md` only — `REFERENCE.md`,
`EXAMPLES.md`, and `abilities/` are the sanctioned overflow and are never line-capped. (The former
per-body 8 KB cap was removed once found to be bogus; the 100-line body warning is the only size cap today.)

These tiers exist because skill bodies drift — sediment, no-op lines, premature-completion
shortcuts — without a pruning discipline; see the ability above for the full treatment.

## Abilities

Abilities are markdown fragments owned by their parent skill. They are NOT registered as skills.

- No frontmatter (or minimal `name`/`description` only).
- Loaded on demand by the parent skill's body referencing them.
- This keeps skill discovery lean (one entry per user-visible capability).
- `REFERENCE.md` and `EXAMPLES.md` join abilities as non-registered overflow tiers — the same "no
  full frontmatter, no parent-less file" invariants below apply to both.

The parent `SKILL.md` should explicitly reference its abilities, e.g.:

```markdown
For testing, follow `abilities/testing.md`.
For security guidance, see `abilities/security.md`.
```

## Naming

- Kebab-case verb-noun: `code-review`, `implementation-planner`, `codebase-onboarding`.
- Language practice is NOT a skill. It lives as fragments under `skills/core/develop/abilities/languages/<lang>.md`, with the per-language practice files and `rules/` overlay in the sibling `<lang>/` directory.
- Workflow-shaped skills: descriptive of the workflow (e.g. `default-feature`, `codebase-onboarding`).

## What NOT to put here

- Anvil's `_addenda/` files (historical artifact). Port the logic into the skill body or an ability fragment, then drop the file.
- Files outside the canonical structure.
- A SKILL.md without a parent folder (every skill is a folder).
- Abilities with full frontmatter (they're fragments, not registered skills).
