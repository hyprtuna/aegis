---
kind: skill
name: recall
description: Use when you need to retrieve relevant past observations, decisions, or patterns from MEMORY.md.
visibility: user
platforms: [claude, opencode, codex, cursor, zed]
---

## Status
recall starting — retrieving relevant memory entries via 3-layer Read+Grep

**Announce:** I'm using the recall skill to retrieve relevant entries from MEMORY.md.

# Recall

Token-economical 3-layer retrieval over `MEMORY.md`. Tools: **Read and Grep only** —
no MCP, no Bash, no vector database. Works on every host.

> **No-hallucination rule.** Only report what is actually in MEMORY.md. Do not invent
> or infer entries. If nothing matches, say so.

## Layer 1 — Index

Grep `MEMORY.md` for headings and concept keywords matching the current task:

```
Grep MEMORY.md for: ## <keywords>
Grep MEMORY.md for: \*\*concepts:\*\* .*<keywords>
```

This returns entry titles and concept lines at minimal token cost (~5–20 tokens per
result). Scan the matches to decide which entries are worth fetching.

## Layer 2 — Context window (memory-bearing agents only)

If the calling agent has `memory: project` (or `user`/`local`), Claude auto-injects
the first **200 lines / 25 KB** of `MEMORY.md` into the system prompt. Check this
injected content first before issuing any Read or Grep call — the entry you need may
already be present. Only proceed to Layer 3 if the injected content does not contain
a sufficient match.

## Layer 3 — Fetch

For each entry title identified in Layer 1 (or absent from Layer 2), Read the
specific section from `MEMORY.md`:

```
Read MEMORY.md from the ## <entry-title> heading to the next ## heading
```

Fetch only the entries you actually need. Full entry bodies run ~500–1 000 tokens
each — fetch selectively.

## Entry shape

Entries follow the structure defined in `rules/memory-discipline.md`:

```
## <title>
- **type:** discovery | decision | blocker | progress | bugfix | change
- **facts:** <immutable: code, paths, commands, versions>
- **narrative:** <prose context>
- **concepts:** <grep-friendly keywords>
- **files:** <relevant file paths>
```

Use `**concepts:**` and entry titles as primary grep targets. `**files:**` lets you find
entries related to a specific path. The Layer-1 grep patterns (`## <keywords>` and
`**concepts:**`) match this exact format.

## Non-Claude hosts

On OpenCode, Codex, Cursor, and Zed, Claude's native `memory` auto-injection is
absent. Use a plain `.aegis-memory/MEMORY.md` file at the project root as the
fallback store. Layers 1 and 3 (Grep + Read) work identically — only Layer 2
(auto-injected context window) is unavailable. Start with Layer 1 on those hosts.

## Done
recall done — relevant entries retrieved and summarized; status: DONE
