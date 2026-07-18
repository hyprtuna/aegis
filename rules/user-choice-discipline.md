---
kind: rule
name: user-choice-discipline
description: When a skill body has a workflow fork, present location options to the user with AskUserQuestion; do not detect-and-assume.
visibility: user
platforms: [claude, opencode, codex, cursor, zed]
---

# user-choice-discipline

> **Scope lane — WHERE/HOW (output location + format).** Fires at a skill's workflow fork: present location and format as two `AskUserQuestion` prompts; do not detect-and-assume either. Sibling (kept separate, do not merge): `decision-template-discipline` governs the **WHAT** dimension — the substantive option/approach choice rendered via the decision template, where it STOP-and-WAITs. This rule owns only the location-and-format fork; the decision-template WAIT-gate is independent (see the Note below).

## The rule

<HARD-GATE phase="workflow-fork">
When a skill generates an artifact and has a workflow fork (different output paths, different
formats, different destinations), the skill MUST present TWO independent `AskUserQuestion` prompts:

1. **Q1 — Where to store?** Options include `.aegis/<kind>/` (Recommended), `docs/<kind>/`,
   `~/.aegis/projects/<auto-name>/<kind>/` (if `~/.aegis/` exists), and a custom-path option.
2. **Q2 — What format?** Offer the formats the artifact's **kind actually ships** per
   `manifest/template-index.json` (`html` / `markdown` / `json`, in any combination the kind
   declares — including **HTML** where the kind ships it), with the kind's `default` format
   marked Recommended. Do not hardcode a fixed three-option set; read the kind's available
   formats from the index.

The skill MUST NOT detect whether `.aegis/` exists and silently pick location or format.
The skill MUST NOT couple location to format — they are independent dimensions.

The rule: **ask both questions, do not detect-and-assume either.**

This gate lifts ONLY when:
- Two `AskUserQuestion` payloads are rendered at the workflow fork (Q1 then Q2).
- Q1 includes ≥3 options, one of which references `.aegis/<kind>/` and is marked Recommended.
- Q2 offers the kind's index-declared formats (per `manifest/template-index.json`), including
  HTML where the kind ships it, with the kind's `default` format marked Recommended. (No fixed
  "exactly three options" contract — the option set is whatever formats the kind declares.)
- Both the user's location response AND format response drive the output — not file-system detection.
- Preferences are checked first (via the project's preference resolver, if one exists);
  if a stored preference exists, both questions may be skipped.
</HARD-GATE>

> **Note — decision gate is unaffected.** `decision-template-discipline`'s WAIT-gate (keyed to
> `${TEMPLATE:decisions}`) is independent of this format fork. Widening Q2 here does not touch
> that gate; the decision template is resolved by the decision gate, not by Q2's format choice.

## Why detect-and-assume breaks adoption

If a skill silently picks Aegis-flavored output only when `.aegis/` already exists, it creates a
chicken-and-egg problem: the directory never gets created on first use, so new projects never get
Aegis-flavored output, so they never benefit from Aegis tooling integration. The two-question
pattern breaks this cycle — the user can opt into Aegis structure on the first run, and the skill
creates the directory if it does not exist.

Coupling location to format creates a second failure: a user who wants `.aegis/reviews/` AND
markdown cannot express that in a single-question pattern. The cross-product of locations and
formats must be available — hence two independent questions.

## How to apply

Short form:

1. **Prompt override check.** Parse the user's prompt for explicit location hints
   (`/store (this )?(at|in|to) (\S+)/i`). If matched, extract the path and skip Q1.
2. **Preference check.** Call the project's preference resolver (if any) for the artifact kind.
   - Per-kind preference exists → skip both Qs; use stored location and format.
   - Default-only preference → use defaults; consider skipping.
   - No preference → ask both Qs.
3. **Q1 — location.** Construct a decision prompt with the `.aegis/<kind>/` option marked
   `recommended: true`. Include ≥3 options.
4. **Q2 — format.** Look the artifact's kind up in `manifest/template-index.json`; build a second
   decision prompt offering exactly the formats that kind ships (`formats` keys — `html` /
   `markdown` / `json`, including HTML where present), with the kind's `default` format marked
   Recommended. Surface via a second `AskUserQuestion`. The option set is index-driven, not fixed.
5. **Post-selection — runtime template resolution.** After both responses, for each chosen
   format: (1) read `${CLAUDE_PLUGIN_ROOT}/manifest/template-index.json`; (2) take
   `kinds[<kind>].formats[<chosen>]`; (3) `Read` that path under the plugin root (e.g.
   `${CLAUDE_PLUGIN_ROOT}/templates/html/<kind>.html`); (4) fill the `<!-- SLOT: … -->` (HTML) /
   `{{ slot.key }}` (markdown) markers with the artifact's content; (5) write `<name>.<ext>` at
   the chosen location (`markdown` → `.md`; `json` → `.json`; `html` → `.html`). If the user
   picks more than one format, repeat for each. This is a **runtime** procedure — `${TEMPLATE:…}`
   is a **build-time** projector directive (see `scripts/project.mjs`), never evaluated at
   runtime; do not attempt to "resolve" one during a skill run. On hosts without a plugin-root
   variable, the templates ship alongside the Aegis install — resolve relative to the install
   root instead (see the OpenCode gap noted in `adapters/opencode/projection.md`).
   - `.aegis/<kind>/` → bootstrap the directory silently (`mkdir -p`).
   - Custom path → validate (relative, no `..`, no cwd escape).
6. **Persist.** Record the chosen location and format as the per-kind preference.

## Kind taxonomy

Use canonical artifact-directory tokens when referencing artifact directories in skill prose.

| Artifact type | Token |
|---|---|
| plan | `${AEGIS_PLANS_DIR}` |
| spec | `${AEGIS_FEATURES_DIR}/<slug>/` |
| research | `${AEGIS_RESEARCH_DIR}` |
| decision | `${AEGIS_ROOT}/decisions/` |
| audit | `${AEGIS_AUDITS_DIR}` |
| review | `${AEGIS_ROOT}/reviews/` |
| ADR | `${AEGIS_ROOT}/adrs/` |

## Red flags (thoughts that mean STOP)

| Thought | Reality |
|---|---|
| "I'll check if `.aegis/` exists and pick automatically" | Detect-and-assume. Show the Q1 choice instead. |
| "The user probably wants Aegis format" | Probably is not agency. Ask. |
| "Location implies format — I only need one question" | They are independent. Ask both. |
| "The skill is simple — no fork needed" | If the output destination or format can vary, there is a fork. Show both questions. |
| "I'll add the prompts later" | Later means never. The fork is now; both prompts are now. |
| "I'll skip Q2 because the user picked .aegis/" | Format is independent of location. Ask Q2 regardless. |

## Reference

- Example: `rules/user-choice-example.md`
