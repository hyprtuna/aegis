---
name: codebase-onboarding
description: 'Use when onboarding to a new codebase — produces an architecture map, key entry points, conventions, and a starter CLAUDE.md.'
---

# Codebase Onboarding

Systematically analyze an unfamiliar codebase and produce two artifacts: a structured onboarding guide and a starter `CLAUDE.md`. Designed for the first time Claude Code opens a repo or when a development joins a new project.

## When to Use

- First session in a new project.
- User says "onboard me", "help me understand this codebase", or "generate a CLAUDE.md".
- User wants a ramp-up guide for a new contributor.

## Phase order (gated)

This workflow is a phase-ordered, gated chain — each phase consumes the prior phase's output and may
not start until it exists:

1. **Reconnaissance** → manifest/framework/entry-point/tooling/test signals.
2. **Architecture Mapping** → tech stack, architecture pattern, key directories, data flow (built
   from Phase 1's signals).
3. **Convention Detection** → naming/error-handling/async/git patterns.
4. **Generate Artifacts** → the onboarding guide + starter `CLAUDE.md` (built from Phases 2–3).

The phases are internal to this workflow (no hand-off to a separate named skill), so it carries no
`x-aegis.pipeline` block. See `docs/workflow-guide.md` → *The phase-ordered gated-workflow
convention*.

## Phase 1 — Reconnaissance

Run these checks in parallel before reading any source files:

1. **Package manifest detection** — `package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `pom.xml`, `build.gradle`, `Gemfile`, `composer.json`
2. **Framework fingerprinting** — `next.config.*`, `angular.json`, `vite.config.*`, Django settings, FastAPI main, Rails config
3. **Entry point identification** — `main.*`, `index.*`, `app.*`, `server.*`, `cmd/`, `src/main/`
4. **Directory snapshot** — top two levels, ignoring `node_modules`, `.git`, `dist`, `build`, `__pycache__`, `.next`
5. **Tooling detection** — linter configs, `Makefile`, `Dockerfile`, `docker-compose.*`, `.github/workflows/`, `.env.example`
6. **Test structure** — `tests/`, `__tests__/`, `*.spec.ts`, `*.test.js`, `pytest.ini`, `vitest.config.*`

Do not read every file. Use Glob and Grep; read selectively only for ambiguous signals.

## Phase 2 — Architecture Mapping

From the reconnaissance data, identify:

- **Tech stack** — language(s), framework(s), database(s), build tools, CI/CD platform
- **Architecture pattern** — monolith / monorepo / microservices / serverless; frontend/backend split; API style
- **Key directories** — top-level directory to purpose mapping
- **Data flow** — trace one request from entry point to response: where it enters, how it is validated, where business logic lives, how it reaches the database

## Phase 3 — Convention Detection

Extract patterns the codebase already follows:

- **Naming conventions** — file casing, component/class naming, test file suffixes
- **Error handling style** — try/catch, Result types, error codes
- **Dependency injection pattern** — or lack thereof
- **Async patterns** — callbacks, Promises, async/await, goroutines, channels
- **Git conventions** — branch naming, commit message style — skip this section if git history is shallow

## Phase 4 — Generate Artifacts

### Onboarding Guide

Produce a structured Markdown guide:

```
## Overview
[2–3 sentences: what the project does and who it serves]

## Tech Stack
| Layer | Technology | Version |
…

## Architecture
[Description or ASCII diagram of how components connect]

## Key Entry Points
[File → purpose table]

## Request Lifecycle
[Trace one API request from entry to response]

## Conventions
[File naming, error handling, testing patterns, git workflow]

## Common Tasks
[Dev server, test, lint, build, migration commands]

## Where to Look
| I want to... | Look at... |
```

### Starter CLAUDE.md

Generate or enhance `CLAUDE.md` based on detected conventions. If one already exists, read it first, then add or correct — never replace existing project-specific instructions.

```
## Tech Stack
## Code Style
## Testing
## Build & Run
## Project Structure
## Conventions
```

## Best Practices

- **Don't read everything** — reconnaissance uses Glob and Grep; Read is for disambiguation only.
- **Verify, don't guess** — if config and code disagree, trust the code.
- **Enhance, don't replace** — existing CLAUDE.md sections are preserved; additions are clearly marked.
- **Stay concise** — the guide should be scannable in two minutes.
- **Flag unknowns** — "Could not determine test runner" is better than a wrong answer.

## Anti-patterns

- Generating a CLAUDE.md over 100 lines — keep it focused.
- Listing every dependency — highlight only the ones that shape how code is written.
- Describing self-evident directory names — `src/` needs no explanation.
- Copying the README verbatim — the guide adds structural insight the README lacks.

## Fragments

Load one when you reach the work it governs. Do not pull the whole tree into context up front, and
do not force-load with an `@`-style directive.

| When to load | Fragment |
|---|---|
| Producing the tech-stack / architecture / conventions map | [`abilities/mapping.md`](./abilities/mapping.md) |
| First pass over an unfamiliar repo — structure, entry points, subsystems | [`abilities/exploration.md`](./abilities/exploration.md) |
| Tracing one concept, function, or data flow into a call-chain map | [`abilities/deep-dive.md`](./abilities/deep-dive.md) |
| Emitting a persona-targeted `.tour` walkthrough anchored to file:line | [`abilities/code-tour.md`](./abilities/code-tour.md) |
| Explaining unfamiliar code or a concept in this project's terms | [`abilities/explaining.md`](./abilities/explaining.md) |
| Auditing a stale or inaccurate CLAUDE.md / AGENTS.md | [`abilities/context-file-audit.md`](./abilities/context-file-audit.md) |
