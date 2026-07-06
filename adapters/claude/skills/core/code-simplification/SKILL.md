---
name: code-simplification
description: 'Use when code can be simplified without changing behaviour — removes dead code, reduces nesting, eliminates premature abstractions.'
---

> **Invoke via `Skill({skill: "aegis:code-simplification"})`.** This is a skill, not an agent. If you reached for the Agent tool, you're using the wrong primitive.

> **Scope.** This skill is **behaviour-preserving structural reduction** of *any* code: dead code, deep nesting, premature abstraction, unclear naming regardless of origin. For **AI-generated smell** specifically — over-commenting, narration comments, excessive JSDoc, runtime validation the type system already guarantees, verbose AI-pattern boilerplate — load the on-demand ability `abilities/slop-removal.md`. Rule of thumb: the generic body below handles structurally complex code; reach for `abilities/slop-removal.md` when the code smells machine-written. This skill pairs with the `code-simplifier` agent (`agents/code-simplifier.md`) — same capability, subagent form.

# Code Simplifier

You simplify code. Your only constraint: all existing behavior must be preserved exactly. You are not a refactoring agent — you don't add features, change APIs, or improve architecture. You make the existing behavior easier to read and maintain.

## Simplification Targets

### Complexity Reducers
- Flatten deeply nested conditionals (early returns, guard clauses)
- Collapse loops that can be replaced by a single array method call
- Remove intermediate variables that are used exactly once and add no clarity
- Replace multi-branch `if/else` with lookup tables or polymorphism where appropriate

### Dead Code Removal
- Unreachable code after unconditional returns
- Commented-out code blocks with no explanation
- Unused variables, parameters, and imports
- Functions that are defined but never called

### Premature Abstraction Removal
- Wrapper functions that just call another function with no transformation
- Interfaces/types with a single implementation that's never expected to vary
- Over-parameterized functions where most parameters always get the same value
- Helper utilities that exist only to shorten one call site

### Naming
- Variables whose names don't convey their purpose (`temp`, `data`, `result`, `item`)
- Boolean variable names that aren't questions (`active` → `isActive`)
- Functions named with verbs that describe how, not what (`processAndFilterAndReturn`)

## Output Format

For each simplification:

```
### File: `path:line-range`

**Before:**
\`\`\`
<original code>
\`\`\`

**After:**
\`\`\`
<simplified code>
\`\`\`

**Why:** <one sentence — what complexity was removed>
```

## Rules

- Never change observable behavior. If you're unsure whether a change is safe, skip it and note why.
- Don't introduce new abstractions to simplify — the goal is less code, not different code.
- Don't simplify test files if the verbosity serves as documentation of intent.
- A three-line function that's called once is fine — don't inline it unless it's genuinely clearer.

## Intensity

The behaviour-preserving constraint and the Output Format above hold at every level. The caller dials
how aggressively to hunt; absent a selection, `full` applies.

### Intensity: lite
Target only the unambiguous wins: dead code (unreachable, unused imports/vars, commented-out
blocks) and trivial nesting flattening via early returns. Skip naming changes and judgment-call
abstraction removal. Lowest-risk pass for a quick cleanup.

### Intensity: full
The baseline — lossless versus this skill's default. Work all four target categories (complexity
reducers, dead code, premature abstraction, naming), and load `abilities/slop-removal.md` when the
code smells machine-written.

### Intensity: ultra
Deepen beyond `full`: always run the `abilities/slop-removal.md` pass, trace cross-file dead code
(exports never imported anywhere), challenge every single-implementation abstraction, and propose a
prioritized follow-up list for changes too risky to apply blind. Pair with a verification run since
the surface touched is wider.
