# adapters — Agent Guidance

## Purpose

`adapters/<host>/` holds **projection notes and gap docs only** for each target host. Hosts read their native files from the repo root (`.claude-plugin/`, `.opencode/`, `.cursor/`, `.rules`, `AGENTS.md`), not from here.

## Iron Rule: No Canonical Duplication

NEVER copy canonical content (skills, agents, commands) into `adapters/<host>/`. The canonical source is `skills/`, `agents/`, etc. Adapter folders hold:

- `projection.md` — what each canonical surface maps to in this host.
- `gaps.md` (optional) — what canonical surfaces have no host counterpart.
- Host-specific generator helpers if needed (avoid until truly needed).

## Layout

```
adapters/
├── claude/projection.md
├── opencode/projection.md
├── codex/projection.md
├── cursor/projection.md
└── zed/projection.md
```

## Each `projection.md` Should Include

1. **Surfaces supported.** What Aegis content this host loads natively.
2. **Surfaces unsupported.** What canonical Aegis concepts have no host home.
3. **Projection mapping.** Aegis canonical path → host native path.
4. **Constraints.** Manifest format, naming rules, version pinning.
5. **Verified vs unverified.** Mark uncertain facts explicitly.

## Per-Host Status

| Host | Status | Plan |
|---|---|---|
| Claude Code | v0.0.1 — shipped | Detailed in this folder |
| OpenCode | v0.0.2 | Documented projection notes; impl deferred |
| Codex | v0.0.3 | Documented projection notes; impl deferred |
| Cursor | deferred (~v0.5.0) | Documented projection notes; impl deferred from v0.0.8 (AG-0011 D1) |
| Zed | deferred (~v0.5.0) | Documented projection notes; impl deferred from v0.0.8 (AG-0011 D1) |
