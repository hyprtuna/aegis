# Prose Style Guide

This is the human-facing source of truth for Aegis's prose denylist — the set of
LLM-cliché terms that `scripts/validate-prose.mjs` flags in canonical markdown.
The script keeps the authoritative term list in a `DENYLIST` const; this document
explains *why* each term is on the list and how the warn→error rollout works. When
you add or remove a term, update both the const and this file in the same change.

## Why a denylist

Aegis content is written by humans and by agents. LLM-generated prose drifts toward
a recognizable register — filler intensifiers, throat-clearing transitions, and
metaphors that add no information ("LLM slop"). These words make docs longer and
vaguer without making them clearer. The denylist is a cheap, conservative guard that
keeps the canonical tree readable.

The list starts small (~15 terms) on purpose. A noisy linter gets ignored. We
expand it deliberately, one reviewed term at a time, per release.

## Warn → error rollout

- **Currently: warn-only.** `validate-prose.mjs` prints every hit (file, line,
  term) and exits `0`. It is NOT wired into `scripts/validate-structure.mjs` and
  never blocks a build. Existing canonical content may already contain some of these
  words; that is expected and tolerated for now. Clearing them is a separate
  techdebt sweep, not a release blocker.
- **`--strict` flag (reserved):** running with `--strict` exits non-zero on any hit.
  Reserved for a future graduation; not used in CI yet.
- **Planned: graduate to error.** Once canonical content has been swept
  clean, the strict behaviour becomes the default and the check joins the standard
  pre-PR gate.

## The denylist

Matching is case-insensitive and whole-word / whole-phrase (so "delve" matches but
"undelved" would not, and "robustness" does not trip "robust"). Fenced code blocks
(```...```) are stripped before matching — code samples are exempt.

| Term | Level | Why it's flagged |
|---|---|---|
| `load-bearing` | warn | Overused metaphor for "important"; say what actually depends on it. |
| `seamless` | warn | Marketing filler; describe the actual behaviour instead. |
| `delve` | warn | Classic LLM tell; prefer "look at", "examine". |
| `tapestry` | warn | Empty metaphor. |
| `realm` | warn | Empty metaphor for "area" / "domain". |
| `journey` | warn | Empty metaphor for "process" / "steps". |
| `unleash` | warn | Hype verb; say what it enables. |
| `harness the power` | warn | Hype phrase; say what it does. |
| `at the end of the day` | warn | Throat-clearing filler. |
| `it's worth noting` | warn | Throat-clearing filler; just note it. |
| `in today's` | warn | "In today's landscape/world" opener; cut it. |
| `landscape` | warn | Common-but-vague; flagged because it pairs with slop openers. Often a false positive in technical prose — warn-only. |
| `robust` | warn | Vague intensifier; say *how* it's robust (handles X, retries Y). Common word — warn-only, expect some legitimate hits. |
| `leverage` (as verb) | warn | Prefer "use". The script flags `leverage` and notes that only verb usage is intended; noun usage ("financial leverage") is a known false positive under whole-word matching. |
| `cutting-edge` | warn | Marketing filler. |
| `moreover` | warn | Throat-clearing transition; cut it or use a plain conjunction. |
| `furthermore` | warn | Throat-clearing transition; cut it or use a plain conjunction. |
| `in summary` | warn | Throat-clearing closer; just make the point. |
| `elevate` | warn | Hype verb; say what actually improves and how. |
| `empower` | warn | Hype verb; say what it enables. |
| `underscore` (as verb) | warn | Cliché for "emphasize"/"show"; say what proves the point. Literal underscore-character usage is a known false positive under whole-word matching. |
| `pivotal` | warn | Vague intensifier for "important"; say why it matters. |

### Notes on known-noisy terms

`robust`, `landscape`, `leverage`, and `underscore` are ordinary English words that
appear in legitimate technical writing. They are intentionally on the list because
they are also strong slop markers, but they are **warn-level** and the linter does
not (and will not, this release) fail on them. Reviewers use judgment. If a term
proves to be mostly false positives in practice, it is a candidate for removal in a
future release review — recorded here, not silently dropped.

`leverage` is meant to catch the *verb* ("leverage the cache"). Whole-word matching
cannot reliably distinguish verb from noun without parsing, so the script flags all
occurrences and appends a note; treat noun usages as benign.

`underscore` is meant to catch the *verb* ("this underscores the point"). Literal
references to the underscore character (`_`) are a known false positive under
whole-word matching; treat those usages as benign.
