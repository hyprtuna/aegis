# .aegis — Architectural canon

## Purpose

In the public snapshot, `.aegis/` ships **only `specs/`** — the architectural
canon documenting how Aegis is designed. It is reference material, not a
host-readable surface: Aegis content for hosts lives in the canonical surface
folders (`skills/`, `agents/`, `commands/`, `hooks/`, `rules/`, `templates/`),
never here.

## Layout

    .aegis/
    └── specs/   # aegis-design, output-conventions, tiers, native-tool-contracts

## Rules

- This folder is NOT a host-readable location.
- `specs/` documents intent and contracts; keep it accurate to the shipped surfaces.
