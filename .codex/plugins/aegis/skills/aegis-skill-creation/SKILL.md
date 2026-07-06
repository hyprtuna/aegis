---
name: aegis-skill-creation
description: 'Use when scaffolding a new skill — emits valid frontmatter and a body that follows Aegis conventions.'
---

# Skill Creator

You scaffold a new skill folder following Aegis conventions; read existing skills in the same family for shape; validate frontmatter and run the static gate before writing.

## Process

1. Gather `name` (kebab-case verb-noun), one-line `description`, `visibility`, target `platforms`, and which folder family (`core/`, `languages/<lang>-developer/`, `workflows/`).
2. **Classify the baseline failure first** (see "Match the Form to the Failure" below) — the failure type drives the body's form.
3. Pick the closest existing skill in the same family as a structural template; read its `SKILL.md`.
4. Create the folder `skills/<family>/<name>/` and write `SKILL.md` inside it. Every skill is a folder; abilities go in `abilities/<x>.md` (no frontmatter, not registered).
5. Write lean frontmatter (the 5 fields + optional extras, see Frontmatter below); write the body.
6. Run the static gate: `node scripts/validate-structure.mjs` then `node scripts/project.mjs` to project to all hosts.
7. Run post-creation verification (see below).

## Frontmatter

Aegis uses lean 5-field frontmatter. Only these fields and namespaced extras are valid:

| Field | Notes |
|---|---|
| `kind: skill` | Always `skill`. |
| `name:` | Kebab-case, unique, matches the folder name. |
| `description:` | One line, trigger-style ("Use when …"), present tense, specific — this is the discovery surface hosts use for skill selection. |
| `visibility: user \| internal` | `user` appears in host skill lists; `internal` is hidden. |
| `platforms:` | Subset of `[claude, opencode, codex, cursor, zed]`. |

When needed, append:
- `source: anvil:<path>` — on migrated items only.
- `x-claude:`, `x-opencode:`, `x-aegis:` — namespaced extras (`argument-hint`, `primitiveHint`, `pipeline`, `intensity`).

See `skills/AGENTS.md` for the full composition block (`x-aegis.pipeline`) and intensity level (`x-aegis.intensity`) conventions. Do not re-invent them here.

## Body Structure

- **Opening line** — one sentence: what the skill does and its approach.
- **`## Process`** — numbered steps, 4–8. The agent's execution path.
- **`## Output`** — optional; what the skill produces (format, structure).
- **`## Common Mistakes`** — optional anti-patterns, 2–4 bullets.
- **Completion criterion** — each `## Process` step should end on a *checkable* condition (can the agent tell done from not-done?); make it *exhaustive* where it matters ("every X accounted for", not "produce a list"). A vague criterion invites premature completion.

## Match the Form to the Failure

Before writing guidance, classify the baseline failure. The form that bulletproofs one failure type measurably backfires on another.

| Baseline failure | Right form | Wrong form |
|---|---|---|
| Skips/violates a rule under pressure (knows better, does it anyway) | Prohibition + rationalization table + red flags | Soft guidance ("prefer...", "consider...") |
| Complies, but output has the wrong shape (bloated prompt, buried verdict, restated spec) | Positive recipe or contract: state what the output IS — its parts, in order | Prohibition list ("don't restate", "never narrate") |
| Omits a required element from something they already produce | Structural: REQUIRED field or slot in the template they fill in | Prose reminders near the template |
| Behavior should depend on a condition | Conditional keyed to an observable predicate ("if the brief exists, reference it") | Unconditional rule + exemption clauses |

**Why prohibitions backfire on shaping problems:** under a competing incentive ("make the prompt self-contained"), agents negotiate with a prohibition. In head-to-head wording tests on dispatch-prompt guidance, the prohibition arm produced clearly more of the unwanted content than the recipe arm (fully separated distributions), and trended worse than even the no-guidance control — micro-test your own case rather than assuming, but never reach for the prohibition by default. A recipe leaves nothing to negotiate: the output matches the stated shape or it doesn't.

**Rules for whichever form you pick:**
- **No nuance clauses.** "Avoid X unless it matters" reopens the negotiation — appending a single nuance clause to a winning recipe degraded it from consistent to noisy in the same wording tests. Express a real exception as its own conditional on an observable predicate.
- **Exemption clauses don't scope.** "This limit doesn't apply to code blocks" still suppresses code blocks. If part of the output must be exempt, restructure so the rule can't reach it.

## Authoring Doctrine

The failure-mode vocabulary — **leading words**, the **progressive-disclosure ladder**, and the **sediment / no-op / premature-completion** failure modes — lives in `abilities/authoring-doctrine.md`. Read it when writing or pruning a skill body.

This is a **different lens** from the table above, not a duplicate: the table picks the guidance *form* once you have classified the *baseline failure*; the doctrine names how a skill body drifts over its life (bloat, stale layers, no-op lines) and how the tiered layout keeps it lean. For the folder layout it implies (lean `SKILL.md` + `REFERENCE.md` + `EXAMPLES.md` + `abilities/`), see `skills/AGENTS.md`.

## Micro-Test the Wording

Full pressure-scenario runs are the final gate, but they are slow and expensive per iteration. Verify the wording itself first with micro-tests:

1. **One fresh-context sample per call** — a raw API call, or a single-shot subagent if you don't have API access. System prompt = the realistic context the guidance will live in (the full skill or prompt template, not the guidance in isolation); user message = a task that tempts the failure.
2. **Always include a no-guidance control.** If the control doesn't exhibit the failure, there is nothing to fix — stop, don't author the guidance.
3. **5+ reps per variant.** Single samples lie.
4. **Manually read every flagged match.** Score programmatically if you like, but template echoes and quoted counter-examples masquerade as hits; automated counts alone overstate both failure and success.
5. **Variance is a metric.** When guidance lands, reps converge on the same shape. Five different interpretations across five reps means the wording isn't binding — tighten the form before adding words.

Micro-tests verify wording; they do not replace pressure scenarios for discipline skills. Pressure scenarios and fixtures live in `scripts/eval/` (see `scripts/eval/README.md`).

## Validation Checklist

Before staging the file:

- [ ] `name` is kebab-case and unique — Grep `skills/` for duplicate `name:` values.
- [ ] Frontmatter contains only the lean 5 fields + namespaced extras (no Anvil-era fields: no `group`, `trigger`, `preferred_model`, `preferred_effort`, `tools`, `chains`, `isHidden`, `language`, `inputs`, `outputs`).
- [ ] Folder layout is correct: `skills/<family>/<name>/SKILL.md`.
- [ ] For heavy reference material, push detail into `abilities/<x>.md`.
- [ ] `node scripts/validate-structure.mjs` passes cleanly.
- [ ] `node scripts/project.mjs` re-run and generated adapter copies committed in the same commit.

## Post-Creation Verification

After writing the skill:

1. Read the file back and confirm YAML frontmatter parses without errors.
2. Check that `name` in frontmatter matches the folder name.
3. Grep `skills/` for duplicate `name:` to confirm uniqueness.
4. Verify the body has a Process section.
5. Run `node scripts/validate-structure.mjs` — must be clean.
6. Run `node scripts/project.mjs` — commit canonical + generated adapter copies together.
