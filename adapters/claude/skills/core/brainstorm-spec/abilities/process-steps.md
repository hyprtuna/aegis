# Process Steps (detail) and Assumptions-First Mode

On-demand detail for the five-step spec process and the Assumptions-First fast path. Parent `SKILL.md` covers the hard gate, Q1/Q2 flow, sibling sub-task, output template, approval handshake, and the quality checklist.

## Step 1: Codebase Scan

Before asking any questions, scan the codebase to establish ground truth:

1. Read `CLAUDE.md` (project root + any relevant subfolder `CLAUDE.md` files).
2. Glob the directories relevant to the goal (`src/`, `skills/`, `agents/`, etc.).
3. Grep for existing implementations, naming patterns, and related tests.
4. Identify:
   - Existing abstractions you must respect or extend.
   - Layer boundaries that must not be violated.
   - Naming conventions already in use.
   - Test patterns and coverage gaps.

Record every finding. These become your assumption candidates.

## Step 2: Assumption Extraction

From the codebase scan, extract all non-obvious assumptions:

- **Architectural assumptions:** "This feature lives in a pure utility layer; it must have no I/O."
- **Interface assumptions:** "The output schema must be exported from the types module."
- **Behavioral assumptions:** "The parser handles case-insensitive tags because the existing code does."
- **Constraint assumptions:** "The skill cannot increase the user-invocable count beyond the configured limit."

Number each assumption (A-001, A-002, …) for traceability.

## Step 3: Decision Derivation

For each assumption that requires a deliberate design choice, promote it to a **decision**.

An assumption becomes a decision when there are two or more reasonable alternatives.

Record each decision with:
- A unique numbered ID (e.g., D-01, D-02)
- The question being decided
- The options considered
- The chosen option and rationale

You must produce at least one decision for any non-trivial spec.

## Step 4: Open Questions (default mode only)

In default mode (without `--assumptions-first`):

- List any remaining ambiguities that the codebase scan could not resolve.
- Present them as numbered questions to the user.
- Wait for answers before drafting the spec.

Skip this step entirely in `--assumptions-first` mode.

**`## Open Questions` section is mandatory in every spec output** (even when empty):

Every spec MUST end with an `## Open Questions` section followed by a bulleted list.
If there are no open questions, use the literal text `- (none)`.

## Step 5: Spec Authoring

Write the spec file to the user's chosen location from Q1.

The spec file MUST contain:

1. YAML frontmatter (see Output Format in SKILL.md).
2. A `## Goal` section.
3. A `## Context` section (codebase summary relevant to the goal).
4. A `## Assumptions` section (numbered list from Step 2).
5. A decisions section (from Step 3) — format depends on Q2 choice; see `structured-spec-extras.md` for grammar.
6. A `## Acceptance Criteria` section (machine-verifiable where possible).
7. A `## Out of Scope` section.
8. A `## Open Questions` section — **mandatory even when empty** (use `- (none)`).

## Assumptions-First Mode

Invoke this mode by including `--assumptions-first` in your input or by starting with "assumptions-first".

**Behavior change:** Skip the open-ended Q&A entirely. Instead:

1. Complete Steps 1–2 (Codebase Scan + Assumption Extraction) as normal.
2. Present the numbered assumption list to the user immediately:

   ```
   I've scanned the codebase. Here are my assumptions — correct any that are wrong:

   A-001: ...
   A-002: ...
   A-003: ...

   Which (if any) are incorrect? I'll update and proceed to drafting the spec.
   ```

3. Wait for the user's corrections (or confirmation that all assumptions are correct).
4. Apply corrections, derive decisions, and write the spec.

This mode is designed for experienced users who want to skip interactive Q&A and immediately see the model's understanding of the codebase. It is faster but requires the user to spot wrong assumptions rather than answering open questions.
