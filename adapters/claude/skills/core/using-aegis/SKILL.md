---
name: using-aegis
description: 'Use at the start of every session to discover Aegis surfaces and apply iron-law rules.'
---

# Using Aegis

Aegis is loaded. You have access to a curated catalog of skills, agents, commands, rules, and templates for software development tasks.

## What's Available

- **Skills** at `skills/`: universal capabilities (`skills/core/`), language overlays (`skills/languages/`), workflow skills (`skills/workflows/`).
- **Agents** at `agents/`: first-class doers — researcher, plan-verifier, code-reviewer, orchestrator, etc.
- **Commands** at `commands/`: composed workflow entry-points (capped ~15).
- **Rules** at `rules/`: iron-law guidance (TDD, evidence-before-assertion, verification-before-completion, etc.). Always-loaded.
- **Templates** at `templates/`: Markdown, JSON, and standalone HTML output skeletons.

## Top User-Invocable Surfaces (start here)

A curated index of the most-reached-for surfaces — not the full catalog. Discover the rest via your host's skill/agent listing.

| Want to… | Invoke |
|---|---|
| Build a feature end-to-end | `default-feature` skill (or `sdd-workflow` for spec-first) |
| Turn a vague goal into an approved spec | `brainstorm-spec` skill |
| Write a phased implementation plan | `implementation-planner` skill |
| Implement under red→green→refactor | `test-driven-development` skill |
| Investigate a bug systematically | `debugging` skill |
| Verify before claiming done | `verification` skill |
| Review a diff (spec-compliance + code-quality) | `code-reviewer` agent (`--type both`, `--strict` for lock-in) |
| Research a topic / weigh options | `research` skill or `researcher` agent |
| Verify a plan against its goal | `plan-verifier` agent |
| Onboard to an unfamiliar codebase | `codebase-onboarding` skill |
| Language-specific work | `skills/languages/<lang>-developer/SKILL.md` |

## How to Use

1. **Skills are invoked through your host's skill discovery.** On Claude: `aegis:<skill-name>` via the Skill tool. On OpenCode: `/aegis:<skill-name>`. On Codex: filesystem auto-discovery.
2. **Agents are invoked through your host's Task/subagent tool** with type `aegis:<agent-name>`.
3. **Iron-law rules apply by default.** They are short imperative directives — read them, follow them.

## Iron Laws (Summary)

The full text lives in `rules/<rule-name>.md`. Highlights:

- **TDD iron law** — write a failing test before implementation for non-trivial work.
- **Evidence before assertion** — claims need concrete citations (file:line, command output).
- **Verification before completion** — never claim done without running verification.
- **Rationalization prevention** — the urge to skip a verification IS the rationalization.
- **One-percent rule** — if there's a 1% chance a skill fits, invoke it.
- **Orchestrator-first** — high-confidence directives route to the named agent before inline handling.

## How to Discover More

- For language work, route through `skills/languages/<lang>-developer/SKILL.md`.
- For workflow work (plan → spec → implement → review), route through `skills/workflows/<workflow>/SKILL.md`.
- For a new domain, check `skills/core/` for a matching skill name.

## What NOT to Do

- Don't ignore iron-law rules — they encode expensive lessons.
- Don't load every skill at once. Aegis is designed for on-demand loading.
- Don't bypass the host's skill discovery — invoke skills via the host's native mechanism.

## Provenance

Aegis is derived from Anvil. The migration discarded the `source:` provenance field; provenance now lives only in `.aegis/audits/` and `.aegis/research/anvil-surface-migration.research.md`.
