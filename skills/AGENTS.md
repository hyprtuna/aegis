# skills — Agent Guidance

## Purpose

`skills/` is Aegis's catalog of reusable capabilities. Every skill is a folder with `SKILL.md` plus optional `abilities/` fragments.

## Layout

```
skills/
├── core/<name>/
│   ├── SKILL.md            # required, lean (<100 lines) — the ONLY registered surface
│   ├── REFERENCE.md        # optional — dense facts / data tables
│   ├── EXAMPLES.md         # optional — worked transcripts
│   └── abilities/<x>.md    # optional — on-demand fragments loaded by a pointer
├── languages/<lang>-developer/
│   ├── SKILL.md
│   ├── abilities/<ability>.md            # on-demand fragments
│   └── rules/{coding-style,patterns,security,testing}.md
└── workflows/<workflow>/
    ├── SKILL.md
    └── abilities/<step>.md
```

## Frontmatter

```yaml
---
kind: skill
name: stable-kebab-slug
description: One-line trigger-style description.
visibility: user | internal
platforms: [claude, opencode, codex, cursor, zed]
---
```

## Composition metadata (`x-aegis.pipeline`)

A skill that composes other skills (a workflow, a review loop) may declare a **composition block** under the `x-aegis` namespace (Iron Law 3). The orchestrator reads it to validate compositions, detect cycles, and auto-invoke prerequisites. It is **optional** — absence means the skill is **atomic** (the backward-compatible default; atomic single-purpose skills carry no block).

```yaml
x-aegis:
  pipeline:
    requires: [design-exploration]      # prerequisite skills auto-invoked first
    handoff: plans                       # named artifact passed forward (template kind) or // REASON:
    next: feature-developer              # the transition target skill
```

Three keys, all optional:

- **`requires: [skill]`** — prerequisite skills auto-invoked before this skill runs.
- **`handoff: <template-kind|artifact-name>`** — the artifact this skill passes forward.
- **`next: skill`** — the skill the transition invokes when this one completes.

Rules (enforced by the `COMPOSITION` validator, `scripts/validate/composition.mjs`):

- **Acyclic.** The graph built from every skill's `requires` + `next` edges must have no cycle (the validator reports the cycle path).
- **Real skills.** Every value in `requires` and `next` MUST name a skill that **exists in canonical** under its **current** name (no phase-label aliases, no renamed-away names).
- **Real handoff.** Each `handoff` MUST name a real template kind from `manifest/template-index.json`, OR carry a `// REASON:` note (inline in the body) justifying a non-template artifact.

Landed warn-only this release (graduates to hard-fail next, per the v0.0.6 convention).

## Intensity levels (`x-aegis.intensity`)

A skill may dial its effort with three intensity levels — `lite`, `full`, `ultra`. This is an
**optional extension of the same `x-aegis` composition namespace** (AG-0214) — a sibling of
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

A skill under `skills/workflows/` is a **phase-ordered, gated chain**: each phase gates on the prior
(it may not start until the predecessor's hand-off artifact exists), and the transition invokes a
*named* `next` skill. Document the phase order and its hand-off artifacts in the workflow body's prose;
where a workflow composes other **named** skills, also declare the gate (`requires`/`handoff`) and the
transition (`next`) in the `x-aegis.pipeline` block above. A workflow whose phases are all internal
(no hand-off to a separate named skill) documents its order in prose and carries no pipeline block.

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
`REFERENCE.md`, `EXAMPLES.md`, and `abilities/*` carry no 5-field frontmatter and are never
independently invoked.

**Validator consistency (mechanical enforcement).** `SKILL_SIZE` (`scripts/validate/skill-size.mjs`,
warn-only) flags a `SKILL.md` body over 100 lines and scans `SKILL.md` only — `REFERENCE.md`,
`EXAMPLES.md`, and `abilities/` are the sanctioned overflow and are never line-capped. (The former
per-body 8 KB cap was removed in v0.2.0; the 100-line body warning is the only size cap today.)

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

- Kebab-case verb-noun: `code-review`, `implementation-planner`, `dependency-management`.
- Language skills: `<lang>-developer` (e.g. `typescript-developer`, `go-developer`).
- Workflow skills: descriptive of the workflow (e.g. `spec-driven-development`, `default-feature`).

## What NOT to put here

- Anvil's `_addenda/` files (historical artifact). Port the logic into the skill body or an ability fragment, then drop the file.
- Files outside the canonical structure.
- A SKILL.md without a parent folder (every skill is a folder).
- Abilities with full frontmatter (they're fragments, not registered skills).
