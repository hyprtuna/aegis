# Two-Stage Review — I/O Payloads and Stage Prompts

On-demand reference for the destination/format questions, the per-stage dispatch prompt templates,
and the merged-result shape. The parent `SKILL.md` carries the stage gates and the decision forks;
this fragment carries the verbatim payloads and prompts.

## Prompt override (parse before asking)

Before presenting any question, scan the user's prompt for a location override:

```
regex: /store (this )?(at|in|to) (\S+)/i
```

If matched, use the captured path as the Q1 answer without asking Q1.

## Q1 — Location

Invoke AskUserQuestion with the following payload:

```json
{
  "question": "Where should the review report be stored?",
  "intro": "Choose where to write the merged review report. Location and format are independent — you will be asked about format next.",
  "options": [
    {
      "label": ".aegis/reviews/<slug> (Recommended)",
      "description": "In-project reviews directory; created if missing. Integrates with Aegis reporting commands."
    },
    {
      "label": "docs/reviews/<slug>",
      "description": "In-project public-shaped docs; visible in rendered documentation."
    },
    {
      "label": "~/.aegis/projects/<auto-name>/reviews/<slug>",
      "description": "Out-of-project; keeps your project repo clean. Only shown when ~/.aegis/ exists."
    },
    {
      "label": "Custom path",
      "description": "Relative path you provide. Must not contain \"..\" or escape the project root."
    }
  ],
  "_rationale": "Co-located with the project and accessible to reporting commands."
}
```

Note: only show the `~/.aegis/projects/` option when `~/.aegis/` exists on the system.

## Q2 — Format

The option set is **index-driven**: the `code-review` kind declares
`formats: { markdown, html, json }` in `manifest/template-index.json` with `default: markdown`,
so Q2 offers Markdown, HTML, and Structured JSON, with Markdown (the default) marked Recommended.

Invoke AskUserQuestion with the following payload:

```json
{
  "question": "What format should the review report use?",
  "intro": "Choose based on who will read the report. The options below are the formats the code-review kind ships per manifest/template-index.json. Format is independent of where the file is stored.",
  "options": [
    {
      "label": "Markdown (Recommended)",
      "description": "Human-readable severity-graded review with section headers; renders in PR diffs and on GitHub. The code-review kind's default format."
    },
    {
      "label": "HTML",
      "description": "Standalone stakeholder deliverable — severity-graded findings and reviewer sign-off as a self-contained page. Best when sharing outside the diff."
    },
    {
      "label": "Structured JSON",
      "description": "Machine-readable review report; consumable by tooling and CI. Schema = the code-reviewer agent's inline ReviewReport."
    }
  ],
  "_rationale": "Markdown is the default and serves PR/GitHub readers; HTML and Structured JSON come straight from the kind's index entry — no hardcoded format list."
}
```

## Structured JSON schema

When the user picks **Structured JSON**, the report follows the `ReviewReport`
schema defined inline in the `code-reviewer` agent (its source of truth — there is no separate
addendum file). The severity vocabulary lives there too, and the `--strict-review` behavior is
the `code-reviewer --strict` mode (the adversarial lock-in / irreversible-decision lens,
`min_confidence: 0`). The markdown and HTML paths use the generic stage output below.

## Reviewer-dispatch doctrine (read before constructing any dispatch prompt)

How you brief a reviewer determines what it can catch. Four rules govern every dispatch
prompt below (source: superpowers `sdd-review-dispatch` @ `420c234`, + the 2026-06-14 audit O-9):

- **Attention-lens — copy the spec's constraints verbatim; don't improvise process rules.**
  Paste the exact acceptance criteria, values, formats, and stated relationships into the
  reviewer's prompt (the `[GLOBAL_CONSTRAINTS]` the implementer also worked from). The
  *process* rules (YAGNI, test hygiene, severity calibration) already live in the dispatch
  template — do not re-improvise them per dispatch; only the spec-specific constraints change.
- **Anti-pre-judging — never tell the reviewer what to conclude.** Do not write "don't flag X",
  "treat X as Minor", or "the plan chose X so accept it" into a dispatch prompt. Those bias the
  verdict. If a prompt you are about to send contains such an instruction, **stop and remove it**.
- **Do not trust the report.** Brief the reviewer that the implementer's report is *unverified
  claims* to check against the diff. A stated rationale ("left it per YAGNI", "kept it simple
  deliberately") is the implementer grading their own work — it **never downgrades a finding's
  severity**.
- **Third verdict `⚠️ Cannot verify from diff`.** A requirement that lives in unchanged code or
  spans tasks cannot be judged from this diff. The reviewer reports it as a `⚠️ Cannot verify from diff` item
  alongside the pass/fail verdict for everything it *could* verify — it does **not** broaden into a
  codebase crawl. The controller resolves the `⚠️ Cannot verify from diff` items.

## Stage 1 — Spec Compliance: dispatch prompt

Dispatch a **read-only** subagent. Grant it Read, Grep, Glob tools only — no Edit, Write, or Bash.

```
Review the work produced for [TASK NAME] against the following acceptance criteria:

[paste the exact acceptance criteria from the plan — verbatim; do not paraphrase]

Treat the implementer's report (if any) as unverified claims; a stated rationale never
downgrades a finding.

Check:
1. Completeness — every required item is present (files, exports, tests, types)
2. No extras — no unrequested files, no scope creep, no features not in the spec
3. Correctness — implementations match the specified interfaces and behaviors

Output exactly one of:
- SPEC_PASS — criteria met, no issues
- SPEC_FAIL: <bullet list of specific missing / extra / incorrect items>
And, alongside whichever verdict applies, list any:
- ⚠️ Cannot verify from diff: <criteria that live in unchanged code or span tasks, and
  what the controller should check> — do not broaden the search to resolve these.
```

Handling: `SPEC_PASS` → proceed to Stage 2. `SPEC_FAIL` → send the specific failure list back to
the implementer, re-dispatch Stage 1, loop until `SPEC_PASS` (max 3 loops before escalating to the
user with the full failure report). `⚠️ Cannot verify from diff` items → the controller verifies them directly
(they do not by themselves block Stage 2). Do not proceed to Stage 2 until Stage 1 passes.

## Stage 2 — Code Quality: dispatch prompt

Dispatch a second **read-only** subagent. Grant it Read, Grep, Glob tools only.

```
You are a senior code reviewer. Review [TASK NAME] for production quality.

Check the following dimensions:
1. Correctness — logic is sound, edge cases handled, no off-by-one errors
2. Architecture — layer boundaries respected, no circular imports, correct abstraction level
3. Security — no injection vectors, no credential leaks, no unsafe shell interpolation
4. Performance — no unnecessary I/O in hot paths, no unbounded loops over large inputs
5. Test quality — tests cover behavior not just lines; failure messages are meaningful; no test-the-mock patterns
6. Convention compliance — strict typing, named exports, async/await, proper import extensions, validation at boundaries

Only report findings with confidence >= 80%. Cite file:line for each finding. Treat the
implementer's report as unverified claims — a stated rationale never downgrades severity.

After all findings (or if none), output exactly one of:
- QUALITY_PASS — no critical findings
- QUALITY_FAIL: <count> issue(s) found — one or more critical findings present
Plus any ⚠️ Cannot verify from diff: <concerns in unchanged code / spanning tasks> for the
controller to check — without broadening the search.
```

Handling: `QUALITY_PASS` → task is ready to mark DONE. `QUALITY_FAIL` → send the specific findings
back to the implementer, re-dispatch Stage 2, loop until `QUALITY_PASS` (max 3 loops before
escalating). Do not mark the task DONE until both stages pass.

## How to invoke from an executor prompt

In any executor agent body, replace the inline two-stage review prose with:

```
After the implementer returns DONE or DONE_WITH_CONCERNS, invoke the `code-review` skill and load
its `abilities/two-stage.md` fragment:
  - Pass: task name, acceptance criteria, and the list of changed files.
  - Block on any SPEC_FAIL or QUALITY_FAIL before marking the task DONE.
```

## Consuming the merged result

After both stages complete, merge the two pass objects into a single review report:

```
{
  "spec_compliance": { "passed": true/false, "findings": [...] },
  "code_quality":    { "passed": true/false, "findings": [...] }
}
```

A task is DONE only when both `passed` fields are `true`.

> **Aegis context:** the `ReviewReport` JSON schema, severity grades, and `--strict-review`
> behavior live in the `code-reviewer` agent (inline `ReviewReport` schema; `code-reviewer
> --strict` mode). There is no separate addendum file.
