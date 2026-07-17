# docs — Agent Guidance

## Purpose

`docs/` holds user-facing and contributor-facing documentation. AGENTS-facing content lives in `AGENTS.md` files; user-facing content lives here.

## Layout

- `specs/` — published architecture canon (`aegis-design.md`, `native-tool-contracts.md`, `output-conventions.md`, `tiers.md`).
- `architecture.md` — overall design (mirrors `docs/specs/aegis-design.md` but tuned for user audience).
- `getting-started.md` — install + first invocation.
- `roadmap.md` — release plan summary.
- `contributor-vs-user.md` — clear boundary: what's user-facing, what's maintainer-only.
- `skill-authoring.md` — how to write a skill.
- `workflow-guide.md` — how Aegis workflows compose (planning → implementation → verification).
- `troubleshooting.md` — common issues.
- `cheatsheet.md` — quick reference.
- `installation.md` — per-host install instructions.

## Rules

- The architecture canon is published at `docs/specs/`; the private `.aegis/specs/` (the `aegis-internal` clone) holds the maintainer copy plus `features/<id>/` decision records. Keep `docs/` how-to content distinct from spec decision records.
- Keep docs short. The Anvil failure mode is endless wiki sprawl.
- Link to research files in `.aegis/research/` when documenting design rationale.
- Update `docs/` in the same change as the release plan that adds the feature being documented.
