---
kind: rule
name: context-budget
description: Use when auditing token overhead across loaded components — produces prioritised savings recommendations before heavy subagent chains.
visibility: user
platforms: [claude, opencode, codex, cursor, zed]
---

# Context Budget

Analyze token overhead across every loaded component and surface the top optimizations to reclaim context headroom. Run this before spawning a long subagent chain or after adding several new components.

## When to Use

- Session quality is degrading or output feels truncated.
- Many skills, agents, or MCP servers were recently added.
- Planning a long multi-agent task and need to know available headroom.
- Orchestrator pre-flight before a complex parallel dispatch.

## Phase 1 — Inventory

Estimate token consumption per component category. Use `words × 1.3` for prose; `chars / 4` for code-heavy files.

| Category | Location | Flags |
|---|---|---|
| Agents | `agents/*.md`, `.claude/agents/*.md` | description > 30 words (loaded on every Task invocation); file > 200 lines |
| Skills | `skills/**/*.md` | file > 400 lines; identical copies across skill directories |
| Rules | `rules/**/*.md`, `skills/universal/rules/*.md` | file > 100 lines; content overlap within category |
| MCP Servers | `.mcp.json` or active MCP config | ~500 tokens/tool schema; > 20 tools per server; servers wrapping CLI tools already available as shell commands (`git`, `gh`, `npm`) |
| CLAUDE.md chain | project + user-level, combined | combined total > 300 lines |

## Phase 2 — Classify

Sort every component into one of three buckets:

| Bucket | Criteria | Action |
|---|---|---|
| Always needed | Referenced in CLAUDE.md, backs an active command, or matches current project type | Keep |
| Sometimes needed | Domain-specific but not in active use for this task | Consider on-demand activation |
| Rarely needed | No command reference, overlapping content, no project match | Remove or lazy-load |

## Phase 3 — Detect Issues

| Issue | Threshold | Impact |
|---|---|---|
| Bloated agent description | > 30 words | Loaded on every Task tool call |
| Heavy agent file | > 200 lines | Inflates Task context on every spawn |
| Redundant skill/rule | Duplicate content across files | Silent token waste |
| MCP over-subscription | > 10 servers or CLI-wrapping servers | Often the single largest lever |
| CLAUDE.md bloat | > 300 combined lines | Loaded at session start |

## Phase 4 — Report

```
Context Budget
══════════════════════════════════════
Total overhead:     ~XX,XXX tokens
Effective headroom: ~XXX,XXX tokens (XX%)

Component Breakdown
───────────────────
Agents      N files    ~X,XXX tokens
Skills      N files    ~X,XXX tokens
Rules       N files    ~X,XXX tokens
MCP tools   N tools    ~XX,XXX tokens
CLAUDE.md   N lines    ~X,XXX tokens

Top Optimizations
─────────────────
1. [action] → save ~X,XXX tokens
2. [action] → save ~X,XXX tokens
3. [action] → save ~X,XXX tokens

Potential savings: ~XX,XXX tokens (XX% of current overhead)
```

## Phase 5 — Behavioral Signs (Qualitative)

Phases 1–4 answer "how much budget exists" from token math. This phase answers "what state is the session in right now," read directly from observable behavior — no token count required. It complements the inventory rather than replacing it, and closes the gap left when the context-window MONITOR was retired in v0.3.5: the monitor could never know the real ceiling (it varies by model and host), but behavioral signs need no ceiling at all. Use inventory for pre-flight planning; use behavioral signs for continuous in-session awareness, since state can shift mid-session even when the pre-flight inventory looked fine.

| Tier | Signals | Action |
|---|---|---|
| PEAK | Sharp, full recall, precise answers | Proceed normally |
| GOOD | Solid work, some overhead | Proceed; stay mindful before new heavy loads |
| DEGRADING | Re-reading files already seen; minor contradiction of earlier decisions; slower convergence | Wrap up the current thread soon; checkpoint progress |
| POOR | Forgetting earlier decisions; truncated or rushed output; repeating completed work; losing the thread | Stop; checkpoint to disk; compact or hand off to a fresh session |

## Best Practices

- **MCP is the biggest lever** — a 30-tool server costs more than all skills combined.
- **Agent descriptions are always loaded** — even unspawned agents inflate every Task tool context via their description.
- **Audit after every addition** — run after adding any agent, skill, or MCP server to catch creep early.
- **Verbose mode for debugging** — use when you need per-file breakdowns, not for regular audits.
