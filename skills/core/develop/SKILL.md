---
name: develop
description: Use when writing or changing application code — applies general coding discipline plus every language and framework practice fragment the task touches.
visibility: user
platforms: [claude, opencode, codex, cursor, zed]
x-claude:
  primitiveHint: skill
---

# Develop

The single entry point for writing and changing code. General discipline lives here; the
language- and framework-specific practice lives in fragments under `abilities/`, loaded on
demand. One skill, many fragments — not one skill per language.

## How to use this skill

1. **Always read `abilities/general.md` first.** It is the baseline: pre-implementation
   checklist, change-scope discipline, style adherence, commit discipline, anti-patterns.
   It applies to every language.
2. **Select fragments from the task's actual files** — see below.
3. **Read each selected fragment before writing code**, not after. A fragment read after the
   diff exists is a review, not guidance.

## Selecting a fragment

Selection is driven by **the files this task touches**, not by what the user names. Look at the
paths you are about to read or edit, plus the project's manifest files, and match them here.

| Signal | Fragment |
|---|---|
| `*.c` `*.cc` `*.cpp` `*.hpp` `CMakeLists.txt` | `abilities/languages/cpp.md` |
| `*.cs` `*.csproj` `*.sln` | `abilities/languages/csharp.md` |
| `*.go` `go.mod` | `abilities/languages/go.md` |
| `*.java` `pom.xml` `build.gradle` | `abilities/languages/java.md` |
| `*.js` `*.mjs` `*.cjs` `package.json` | `abilities/languages/javascript.md` |
| `*.kt` `*.kts` | `abilities/languages/kotlin.md` |
| `*.php` `composer.json` | `abilities/languages/php.md` |
| `*.py` `pyproject.toml` `requirements*.txt` `setup.py` | `abilities/languages/python.md` |
| `*.rb` `Gemfile` | `abilities/languages/ruby.md` |
| `*.rs` `Cargo.toml` | `abilities/languages/rust.md` |
| `*.swift` `Package.swift` `*.xcodeproj` | `abilities/languages/swift.md` |
| `*.ts` `*.tsx` `tsconfig.json` | `abilities/languages/typescript.md` |

**Framework fragments layer on top of a language fragment — they never replace it.**

| Signal | Fragment | Layers on |
|---|---|---|
| `manage.py` `settings.py` `urls.py` | `abilities/languages/django.md` | python |
| FastAPI app / `APIRouter` imports | `abilities/languages/fastapi.md` | python |
| `artisan` `app/Http/` | `abilities/languages/laravel.md` | php |
| `next.config.*` `app/` `pages/` | `abilities/languages/nextjs.md` | javascript or typescript, plus react |
| `config/routes.rb` `app/models/` | `abilities/languages/rails.md` | ruby |
| `*.jsx` `*.tsx`, `react` in `package.json` | `abilities/languages/react.md` | javascript or typescript |
| `@SpringBootApplication`, `spring-boot` dependency | `abilities/languages/spring.md` | java or kotlin |

**When the files give no signal** (a fresh repo, a scratch file, a question with no code yet) and
the user named no language, load `abilities/general.md` alone and ask which language applies. Do
not guess a language from the project's name or the user's history.

Each language fragment is an index. It names its own practice files (`<lang>/<lang>-development.md`,
`<lang>/<lang>-testing.md`, …) and, where one exists, a `<lang>/rules/` overlay covering coding
style, patterns, security, and testing. Read the index, then open only the files the current
request needs.

## Multi-fragment tasks are the normal case

**Load every fragment that applies. Do not stop at the first match.** Most real tasks touch more
than one:

- A typed React component → `typescript.md` **and** `react.md`.
- A Next.js route handler in TypeScript → `typescript.md`, `react.md`, **and** `nextjs.md`.
- A Django model plus its migration → `python.md` **and** `django.md`.
- A Go service with a TypeScript client in one change → `go.md` **and** `typescript.md`.

Where fragments overlap, the more specific one wins: a framework fragment's guidance overrides
its host language's on the same point, and `general.md` is the floor both build on. If two
fragments genuinely conflict on a point neither is more specific about, follow the project's
existing code and say which you chose.

## Task-shaped fragments

Language choice is not the only axis. These load on the shape of the work, alongside whichever
language fragments apply:

| The task at hand | Fragment |
|---|---|
| Reducing code without changing behaviour — dead code, nesting, premature abstraction | `abilities/simplification.md` |
| Auditing, updating, or resolving conflicts in dependencies | `abilities/dependencies.md` |
| Designing or building an MCP server — tool design, scaffolding, verification | `abilities/mcp-servers.md` |

**No match?** Use `abilities/general.md` alone. A language with no fragment is not a gap to
paper over — apply the general discipline and the project's own conventions.

## Loading discipline

Read a fragment when you reach the work it governs. Do not pull the whole `abilities/` tree into
context up front, and do not force-load fragments with an `@`-style directive — that spends the
context budget before you know which fragments the task needs.

## Related skills

Implementation is one phase. For the surrounding work, invoke the skill by name rather than
improvising it here: `test-driven-development` for red→green→refactor, `debugging` for a
systematic bug hunt, `code-review` for reviewing a diff, and `verification` before claiming the
work is done.
