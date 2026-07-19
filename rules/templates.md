---
kind: rule
name: templates
description: Use when a skill or agent emits a named artifact — the referenced template owns layout/format and is substituted verbatim; carry only the ${TEMPLATE} reference, never duplicated format prose.
visibility: user
platforms: [claude, opencode, codex, cursor, zed]
---

# templates

## The template-authoritative model

When a skill or agent emits a named artifact, the **template is authoritative**:

- `${TEMPLATE:<kind>}` substitutes **verbatim** — it resolves to the kind's `default`
  format per `manifest/template-index.json` and the resolved body is dropped in as-is.
- `${TEMPLATE:<kind>:<format>}` substitutes an **explicit** format (`markdown` / `json` /
  `html`) the kind ships per the index.
- The **template owns layout, severity taxonomy, and section order.** It is the single
  source of truth for what the artifact looks like.
- Skills and agents carry **ONLY** the `${TEMPLATE}` reference plus rule links — never their
  own duplicated format, layout, or question-and-answer prose. If a producer body restates
  the artifact's format or taxonomy, that duplication is removed and the body relies on the
  template instead.

The location/format question flow (Q1 — where to store, Q2 — which format) is not a per-skill
concern either: it lives in `rules/user-choice-discipline.md`, which reads the kind's available
formats from `manifest/template-index.json`. Producers point at that rule rather than inlining
their own Q&A payloads.

### Why template-authoritative (audit §3 "code-review duality")

The surface audit (`.aegis/research/aegis-surface-audit.research.md` §3) flagged a duality for
the `code-review` kind: is the `${TEMPLATE}` an authoritative body the skill defers to, or a
"skeleton" the skill keeps its own Q&A and format prose alongside? The audit's recommendation —
adopted here as the canonical model — is **template-authoritative**: the template body is the
real thing, the skill shrinks to a reference. The rejected alternative was the "skeleton" model
(skill keeps duplicated format/Q&A prose) and the "strip HTML+JSON from the kind" option. This
rule generalizes the decision: template-authoritative is the contract for **every** kind, not
just `code-review`.

### How to apply

1. Identify the artifact kind (a key in `manifest/template-index.json`).
2. In the producer body, reference `${TEMPLATE:<kind>}` for the working default, and
   `${TEMPLATE:<kind>:<format>}` for an explicit non-default format on request.
3. Honor the kind's index `default` (per `user-choice-discipline`). Where the index `default`
   is `html` but the working artifact is prose, request `${TEMPLATE:<kind>:markdown}` explicitly
   rather than silently flipping the index default.
4. Do NOT restate the template's layout, section order, or severity taxonomy in the producer.
   Remove any such duplication and rely on the substituted template body.
5. Defer the location/format question flow to `rules/user-choice-discipline.md`.

## Named-artifact rule

Any skill or agent that emits a **named artifact** MUST reference a template kind — via a
`${TEMPLATE:<kind>}` reference — **or** carry a `// REASON:` note justifying why no template
applies.

A **named artifact** is a durable, structured output the producer writes or hands off: a review,
a plan, a spec, a research report, a plan-audit report, a design system, a PR writeup, a concept
explainer, and the like — anything a downstream reader or tool consumes as a file or a named
deliverable. Ephemeral conversational prose (an inline answer, a status line, a one-off summary
that is not written anywhere) is **not** a named artifact and is out of scope.

The contract:

- **Reference a kind.** Point at the kind through the substitution form so the template owns the
  layout and the producer carries no duplicated format prose (see the template-authoritative
  model above).
- **Or justify the exception.** If the artifact genuinely has no template kind (and minting one
  is out of scope), add a `// REASON:` note in the body stating why. This keeps the gap honest
  and visible rather than silently baked-in.

### Enforcement

`scripts/validate/named-artifact-template.mjs` (`NAMED_ARTIFACT_TEMPLATE`) checks this rule. It
is currently **warn-only** — it surfaces producers that emit a named artifact without a template
reference or a `// REASON:` note, but does not fail the build. It graduates to **hard-fail** in a
later release, consistent with the usual warn → error convention recorded in
`AGENTS.md`.

Kinds flagged `designOnly: true` in `manifest/template-index.json` are **expected-orphan**: they
ship as design references with no near-term producer, so the validator does not warn that they
lack one. See `docs/templates.md` for the design-only roster.
