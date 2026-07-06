# Skill Authoring

## Skill Anatomy

A skill is a folder at `skills/<scope>/<name>/` with:

```
skills/<scope>/<name>/
├── SKILL.md                       # registered skill (frontmatter required)
├── abilities/                     # optional fragments (no frontmatter, NOT registered)
│   ├── <ability>.md
│   └── ...
└── rules/                         # language skills only
    ├── coding-style.md
    ├── patterns.md
    ├── security.md
    └── testing.md
```

## Frontmatter

Lean 5-field:

```yaml
---
kind: skill
name: stable-kebab-slug
description: Trigger sentence — "Use when X, Y, or Z."
visibility: user        # or 'internal' for skills only loaded by other skills/agents
platforms: [claude, opencode, codex, cursor, zed]
source: anvil:<path>    # only for migrated content
---
```

**Important:** `description` is a trigger sentence, not a summary. Hosts auto-fire skills based on description match. Write it as "Use when…" so the host knows when to load it.

## Abilities

Abilities live at `skills/<name>/abilities/<ability>.md`. They are:

- Plain markdown.
- NO frontmatter (or minimal `name` + `description` only).
- NOT registered as skills.
- Loaded on demand by the parent SKILL.md.

The parent SKILL.md body says, e.g.:

```markdown
For testing guidance, follow `abilities/testing.md`.
For security review steps, see `abilities/security.md`.
```

The host loads the ability only when the parent skill needs it.

## When to Use Abilities vs Separate Skills

Use abilities when the sub-capability is:
- Only useful in the context of the parent.
- Frequently NOT needed (loading it always wastes tokens).
- Tightly coupled to the parent's flow.

Use a separate skill when the sub-capability is:
- Independently useful across multiple parents.
- Has its own clear trigger.
- Discoverable on its own.

Example: `code-review` is a skill. `code-review/abilities/comment-analyzer.md` is an ability — only used when code-review runs.

## Skill Body Structure

```markdown
---
kind: skill
name: example
description: Use when …
visibility: user
platforms: [claude, opencode, codex, cursor, zed]
---

# Example Skill

Brief purpose (1-2 lines).

## When to Use

- Trigger 1
- Trigger 2

## Procedure

1. Step one.
2. Step two — if X, load `abilities/x-handler.md`.

## Output

Describe expected output format (markdown, JSON, or templates/html/<name>.html).
```

## Language Skills

Language skills live at `skills/languages/<lang>-developer/`:

```
skills/languages/typescript-developer/
├── SKILL.md
├── abilities/
│   ├── typescript-development.md
│   └── typescript-typing.md
└── rules/
    ├── coding-style.md
    ├── patterns.md
    ├── security.md
    └── testing.md
```

The parent SKILL.md routes to abilities and rules based on the request.

## Workflow Skills

Workflow skills live at `skills/workflows/<workflow>/`:

```
skills/workflows/spec-driven-development/
├── SKILL.md
└── abilities/
    ├── brainstorm-spec.md
    ├── write-plan.md
    ├── verify-plan.md
    └── execute-plan.md
```

The parent SKILL.md orchestrates the workflow's steps as abilities.

## Anti-Pattern / Failure-mode Call-outs

Inline call-outs warn the reader away from a known mistake at the exact point in
the procedure where it would happen. Aegis uses two blockquote conventions:

- **`> **Anti-pattern:** …`** — a tempting-but-wrong *approach*. Use it when there
  is an obvious shortcut a reader (or agent) will reach for that produces worse
  results. Name the wrong approach and the right one in one breath.
- **`> **Failure mode:** …`** — a concrete *way the task breaks* if a step is
  skipped or done carelessly. Use it to flag the consequence, not the alternative
  approach — what goes wrong and how to tell.

Keep each call-out to one or two sentences and place it immediately after the step
it guards, not in a separate section. If you find yourself writing more than two,
the procedure itself probably needs restructuring.

### Examples

A skill body routing to abilities might warn against inlining detail:

```markdown
## Procedure

1. Read the target file before editing it.

   > **Anti-pattern:** rewriting the whole file from memory. Edit the specific
   > lines you've read — blind rewrites silently drop unrelated content.

2. For the typing rules, load `abilities/typing.md`.

   > **Failure mode:** if you skip the ability and guess the conventions, the
   > output passes review locally but fails the project's `tsc --strict` gate.
```

Rendered, each call-out is a visually distinct blockquote the reader cannot miss
while scanning the steps.

## Validation

Before committing:

```bash
node scripts/validate-structure.mjs
```

This verifies your skill's frontmatter conforms to the schema and that no stray guidance files were added.
