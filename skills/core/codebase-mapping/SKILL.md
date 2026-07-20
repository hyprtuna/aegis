---
name: codebase-mapping
description: 'Use when mapping an unfamiliar codebase — surfaces tech stack, architecture, conventions, concerns.'
visibility: user
platforms: [claude, opencode, codex, cursor, zed]
x-claude:
  primitiveHint: skill
---

# Codebase Mapper

Produce a structured analysis of a codebase across four dimensions: technology, architecture, conventions, and concerns.

## When to Use

- Onboarding to an unfamiliar project
- Before starting a new milestone on an existing codebase
- When you need to understand a codebase before planning work
- After a major refactoring to verify the new state

## The Four Dimensions

### 1. Technology Stack

Identify:
- **Languages**: primary and secondary, with versions (from config files)
- **Frameworks**: web, CLI, testing, build (from package.json, Cargo.toml, etc.)
- **Dependencies**: key runtime deps and their purposes
- **Build system**: how the project builds, what tools are used
- **Test framework**: what runs the tests, where test files live
- **CI/CD**: what pipelines exist (GitHub Actions, GitLab CI, etc.)

Sources: package.json, Cargo.toml, pyproject.toml, go.mod, CMakeLists.txt, Makefile, .github/workflows/

### 2. Architecture

Map:
- **Entry points**: where does execution start? (main, bin/, index, routes)
- **Module structure**: what are the major modules/packages?
- **Layer boundaries**: are there clear layers? What are the import rules?
- **Data flow**: how does data move through the system?
- **Design patterns**: what patterns are used? (MVC, clean arch, hexagonal, etc.)
- **External integrations**: what external services does it talk to?

Sources: directory structure, import graphs, README, CLAUDE.md

### 3. Conventions

Extract:
- **Naming**: file naming, variable naming, function naming patterns
- **Code style**: formatting (tabs/spaces, semicolons, quote style), linting config
- **Error handling**: how errors are handled (exceptions, Result types, error codes)
- **Testing patterns**: how tests are structured, what's tested, what's mocked
- **Commit style**: conventional commits, prefixes, message format
- **Documentation style**: JSDoc, docstrings, inline comments, README format

Sources: .editorconfig, .eslintrc, .prettierrc, CLAUDE.md, recent commits, existing tests

### 4. Concerns

Flag:
- **Technical debt**: TODOs, FIXMEs, deprecated patterns, old dependencies
- **Security**: hardcoded secrets, missing input validation, insecure patterns
- **Complexity hotspots**: files with high cyclomatic complexity, large functions
- **Missing coverage**: areas with no tests
- **Inconsistencies**: places where different patterns are used for the same thing

Sources: grep for TODO/FIXME/HACK, dependency audit, file size analysis

## Output Format

The analysis follows the `code-understanding` template kind — fill its structure, mapping the four dimensions onto its sections (widen with extra sections where a dimension has no matching slot):

${TEMPLATE:code-understanding}

Populate the kind's sections from the four dimensions above: the **components** list carries Technology Stack + Architecture (entry points, module structure, layers, design pattern, key dependencies); the **call sequence** captures the dominant data flow; **references** carries Conventions and Concerns (naming, code style, error handling, commit style; tech debt, security, complexity hotspots, missing tests). Cite specific files and line numbers for every claim.

For a machine-consumed call-graph (structured data another tool ingests), emit the `code-understanding` **json** variant instead. For a navigable standalone walkthrough deliverable, render the `code-understanding` **html** variant on request. Both are on-request only — the markdown above is the working default.

## Rules

- Cite specific files and line numbers for every claim
- Do not speculate — report what you can verify
- If a dimension is not determinable, say so
- Focus on what would help a new development contribute effectively
