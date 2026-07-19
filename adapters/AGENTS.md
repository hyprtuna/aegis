# adapters — Agent Guidance

## Purpose

`adapters/<host>/` holds **projection notes and gap docs only** for each target host. Hosts read their native files from the repo root (`.claude-plugin/`, `.opencode/`, `.cursor/`, `.rules`, `AGENTS.md`), not from here.

## Iron Rule: No Canonical Duplication

NEVER **hand-copy** canonical content (skills, agents, commands) into `adapters/<host>/`. The canonical source is `skills/`, `agents/`, etc. Adapter folders hold:

- `projection.md` — what each canonical surface maps to in this host.
- `gaps.md` (optional) — what canonical surfaces have no host counterpart.
- Host-specific generator helpers if needed (avoid until truly needed).

**Sanctioned exception: `adapters/claude/{skills,agents,commands}/`.** This tree is not
hand-copied canonical — it is **generated** by `scripts/project.mjs` (`projectClaude()`)
and drift-guarded: `validate-structure.mjs`'s `claude-drift` rule hard-fails if the
committed tree diverges from what a fresh `node scripts/project.mjs` run would produce.
It exists because Claude's plugin loader needs a host-native projection that canonical
alone cannot provide — flattened `x-claude.*` frontmatter, resolved `${TEMPLATE:*}`
directives, injected `tools:`/`disallowedTools:`/`memory:`, and the re-injected Invoke-via
blockquote (see `adapters/claude/projection.md` "Generated-Tree Projection"). No maintainer
ever edits a file under `adapters/claude/skills|agents|commands/` by hand; every change
flows canonical → `project.mjs` → generated tree. The Iron Rule still forbids *authoring*
content directly in `adapters/<host>/` — this exception covers only the projector's own
generated output, which is the opposite of duplication-by-hand.

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
