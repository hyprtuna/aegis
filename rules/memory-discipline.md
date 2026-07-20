---
name: memory-discipline
description: Governs how memory-enabled agents observe, curate, and protect MEMORY.md — taxonomy, entry shape, curation discipline, and secret-scan gate.
visibility: user
platforms: [claude, opencode, codex, cursor, zed]
---

# memory-discipline

Applies to any agent with `x-claude.memory` or any workflow that writes to `MEMORY.md`.

## Observation taxonomy

Every MEMORY.md entry carries a `type` drawn from this closed set:

| Type | When to use |
|---|---|
| `discovery` | A non-obvious fact about the codebase, API, or environment. |
| `decision` | A choice made and the reasoning behind it. |
| `blocker` | An unresolved problem or dead-end worth remembering. |
| `progress` | A milestone or completion state worth persisting across sessions. |
| `bugfix` | An error→fix pattern — root cause + minimal fix. |
| `change` | A significant structural or behavioral shift to the project. |

## Which store?

Don't dump everything in one store — route each learning to the store that matches
its lifetime:

| Store | Use for | Not for |
|---|---|---|
| `MEMORY.md` | Durable, project-specific facts an agent needs across future sessions (see taxonomy above). | Guidance every contributor/agent needs up front — that's `AGENTS.md`/`CLAUDE.md`. |
| `AGENTS.md` / `CLAUDE.md` | Repo/project conventions, iron laws, workflow rules — loaded every session, human-authored. | Session-scoped facts, one-off discoveries, anything that will go stale within a task. |
| Ephemeral scratch (scratchpad, task notes) | Session-only working state — intermediate results, in-flight reasoning. | Anything the next session or another agent needs to recall — promote it to `MEMORY.md` first. |

**Do not store:** duplicates of an existing entry (supersede instead, per Curation
discipline), facts that are stale or task-complete, or anything derivable by reading
the code/config directly (a fact that a `grep`/`Read` recovers cheaply doesn't earn a
permanent slot).

## Entry shape

Each entry uses this structure so Grep and the `recall` skill can index it reliably:

```markdown
## <title>

- **type:** <type>
- **facts:** <concise bullet list — concrete, verifiable>
- **narrative:** <one-paragraph reasoning or context>
- **concepts:** <comma-separated keywords for grep>
- **files:** <comma-separated file paths, if relevant>
```

Keep `facts` immutable (code, paths, commands, versions — never paraphrase).
Keep `narrative` short; compress only prose, never the `facts` list.

## Curation discipline

Curate MEMORY.md when it exceeds **200 lines or 25 KB** (the native auto-inject cap):

1. **Preserve-exactly.** `facts`, inline code, paths, commands, and version numbers are
   read-only regions — compress only prose around them, never the data itself.
2. **Promote recurring patterns.** If the same root cause or fix appears more than
   once, merge into a single entry with a `count` annotation.
3. **Supersede contradictions.** When a newer entry overrules an older one, delete the
   old entry entirely — do not keep both. Add a `supersedes:` note in the new entry.
4. **Drop resolved blockers.** Remove `blocker` entries once the issue is resolved;
   optionally promote a summary to a `decision` or `bugfix` entry.

After curation, verify the structure survived: every remaining entry still has the
`type / facts / narrative / concepts` fields and a level-2 heading.

## Secret-scan write discipline

Before writing any entry to MEMORY.md, apply the same discipline as `secret-scan.sh`:

- **Never write** API keys, tokens, passwords, private keys, or any credential to
  MEMORY.md — they persist across sessions and may be injected into subagent context.
- **Never write** personally-identifying information (names, emails, phone numbers).
- If a fact you want to record contains a secret value, redact it to a placeholder
  (e.g. `API_KEY=<redacted>`) before writing.
- If you are uncertain whether a value is a secret, omit it.

This discipline mirrors the `scripts/secret-scan.sh` policy. **There is no automated
enforcement at the write boundary** — `MEMORY.md` lives in host-managed agent-memory
directories outside repo scans, so the secret-scan script does not run at write time.
This is a model-followed convention, not a mechanical gate. Memory writes carry the
same risk as committing a secret to git — treat them with the same care.
