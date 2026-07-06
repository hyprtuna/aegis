# docs — Agent Guidance

## Purpose

`docs/` holds user-facing and contributor-facing documentation. AGENTS-facing content lives in `AGENTS.md` files; user-facing content lives here.

## Layout

- `architecture.md` — overall design (mirrors `.aegis/specs/aegis-design.md` but tuned for user audience).
- `getting-started.md` — install + first invocation.
- `roadmap.md` — release plan summary.
- `contributor-vs-user.md` — clear boundary: what's user-facing, what's maintainer-only.
- `skill-authoring.md` — how to write a skill.
- `workflow-guide.md` — how Aegis workflows compose (planning → implementation → verification).
- `troubleshooting.md` — common issues.
- `cheatsheet.md` — quick reference.
- `installation.md` — per-host install instructions.

## Rules

- No duplicated content between `docs/` and `.aegis/specs/`. Specs are decision records; docs are how to use.
- Keep docs short. The Anvil failure mode is endless wiki sprawl.
- Link to research files in `.aegis/research/` when documenting design rationale.
- Update `docs/` in the same change as the release plan that adds the feature being documented.
