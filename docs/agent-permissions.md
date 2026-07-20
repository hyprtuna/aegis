# Agent Permissions

Aegis ships **18 agents**. Each one runs under a declared permission posture so a
reviewer can't quietly edit files and an autonomous worker's reach is explicit.
This page explains the model, the buckets, where the data lives, and how it
projects into each host.

> **One source of truth.** Permission posture for every agent lives in
> `manifest/permissions.json` (validated by `manifest/schemas/permissions.schema.json`).
> Agent frontmatter stays lean (the 5-field schema) — there is **no** inline
> `x-claude.permissions` block. Change a permission in the manifest; the projector
> and the audit table follow. (Decision D1.)

## The model: read-only baseline, opt-in elevation

Every agent inherits the same baseline unless the manifest says otherwise:

- **Claude:** `tools: [Read, Grep, Glob]`
- **OpenCode:** `{ "*": "deny", "read": "allow", "grep": "allow", "glob": "allow", "list": "allow" }`

Anything beyond reading — `Edit`, `Write`, `Bash`, `Task`, `WebFetch`,
`WebSearch`, or MCP tools — requires an **explicit** declaration in the manifest
with a one-line `justification`. This is least-privilege as the default: a new
agent that forgets to declare a bucket is read-only, not omnipotent. (Decision D2.)

**14 of the 18 agents are read-only-family** — they never modify the workspace.
Their reach tops out at reading, scoped test/verification Bash (RO-bash), web
research (RO-web), or pure subagent dispatch (Task-only). **The other 4 are
elevated** to edit/write/general-shell: `code-simplifier` (Edit), `mcp-builder`
(Full), `subagent-executor` (Full+Task), and `ultra-worker` (Full+Task+Web). The
single RW-bash agent, `build-error-resolver`, sits on the boundary — it can Edit
and run *build* commands but not write new files or run arbitrary shell. The
per-agent grants are declared in `manifest/permissions.json`.

## The 9 buckets

A bucket is a named permission template. Every agent in the same bucket gets the
same grant, which keeps the manifest (and PR diffs) quiet.

| Bucket | Claude `tools` | OpenCode `permission` | Used by |
|---|---|---|---|
| **RO** | `[Read, Grep, Glob]` | `{*: deny, read/grep/glob/list: allow}` | reviewers, auditors, architect |
| **RO-web** | RO + `[WebFetch, WebSearch]` | RO + `{webfetch: allow, websearch: allow}` | researcher, framework-selector |
| **RO-bash** | RO + `Bash(npm test*)`, `Bash(bun test*)`, `Bash(pnpm test*)`, `Bash(node *)`, `Bash(tsc *)`, `Bash(go test*)`, `Bash(cargo test*)`, `Bash(pytest*)` | RO + scoped `bash` allowlist (`*: deny`, test runners `allow`) | test-analyzer, doc-verifier |
| **RW** | `[Read, Edit, Grep, Glob]` | RO + `{edit: allow}` | code-simplifier |
| **RW-bash** | RW + `Bash(npm *)`, `Bash(bun *)`, `Bash(pnpm *)`, `Bash(node *)`, `Bash(tsc *)`, `Bash(go build*)`, `Bash(go vet*)`, `Bash(cargo check*)`, `Bash(cargo build*)` | RW + scoped `bash` allowlist (build commands) | build-error-resolver |
| **Full** | `[Read, Edit, Write, Grep, Glob, Bash, mcp__*]` | `{*: allow, bash: ask}` | mcp-builder |
| **Task-only** | `[Read, Grep, Glob, Task]` | RO + `{task: allow}` | orchestrator |
| **Full+Task** | `[Read, Edit, Write, Grep, Glob, Bash, Task]` | `{*: allow, bash: ask, task: allow}` | subagent-executor |
| **Full+Task+Web** | `[Read, Edit, Write, Grep, Glob, Bash, Task, WebFetch, WebSearch]` | `{*: allow, doom_loop: allow}` | ultra-worker |

OpenCode permission values are tri-state (`allow` / `ask` / `deny`) with glob
support and last-match-wins. That's why `Full` agents get `bash: ask` rather than
a blanket `allow` — the host pauses for confirmation on shell commands.

## Declaring an agent's permissions

Add (or edit) an entry under `agents.<name>` in `manifest/permissions.json`:

```json
"my-new-agent": {
  "bucket": "RO",
  "claude": { "tools": ["Read", "Grep", "Glob"] },
  "opencode": {
    "*": "deny", "read": "allow", "grep": "allow", "glob": "allow", "list": "allow"
  },
  "justification": "Reads and reports; no writes."
}
```

Rules:

- `bucket` is the human label; `claude` and `opencode` carry the concrete grant.
- `justification` is mandatory — one line on **why** this agent gets this reach.
- If the agent's body makes a read-only claim (e.g. "Read/Glob/Grep only — no
  shell access"), add a `prose` field quoting it so the drift lint can assert the
  body and the grant agree (see [Drift lint](#prose-vs-declared-drift-lint)).
- Run `node scripts/validate-structure.mjs` — it fails if an agent in `agents/`
  has no manifest entry, or if the entry doesn't match the schema.

That's the whole authoring story. You do **not** touch agent frontmatter, and you
do **not** hand-edit any projected host file (`scripts/project.mjs` owns those).

## How it projects per host

### Claude Code — `tools:` allowlist

The projector emits the manifest's Claude `tools` array into the generated agent
file's frontmatter:

```
adapters/claude/agents/<name>.md   ← generated tree
```

> **Path note.** The generated Claude agent tree lives at
> **`adapters/claude/agents/<name>.md`**, not `.claude-plugin/agents/` as some
> older spec text says. Cross-reference `adapters/claude/projection.md` for the
> full Claude mapping.

Aegis uses a positive **allowlist** (`tools: [Read, Grep, Glob]`), not a
`disallowedTools` denylist. An allowlist is enumerable and drift-detectable; a
denylist is fail-open (a new Claude tool ships and an un-updated denylist silently
grants it). (Decision D3.)

### OpenCode — `agent.<name>.permission` via the config hook

OpenCode does **not** honour a `permission:` block in agent markdown frontmatter —
that data lives in `opencode.json` under `agent.<name>.permission`. The Aegis
OpenCode plugin (`.opencode/plugins/aegis.js`) already exposes a `config(cfg)`
hook (used from early on for `skills.paths`); the permissions projector extends
that same hook to merge each agent's `permission` block from the manifest, plus
the global deny block (below). See `adapters/opencode/projection.md`.
(Decisions D4 / D5.)

### Codex / Cursor / Zed — honest gap (advisory only)

None of these three hosts has a per-agent tool-restriction primitive today. Aegis
does **not** fake one. The permission posture is **advisory** on these hosts — the
manifest still documents intent, but nothing enforces it at runtime. This gap is
stated plainly in each host's `adapters/<host>/projection.md` under `## Permissions`.
Writing prose like "this agent must not edit files" into an AGENTS.md would be
documenting enforcement that doesn't exist, so we don't. (Decision D6.)

## Plugin-level cross-cutting deny

Beyond per-agent grants, `manifest/permissions.json` carries a top-level
`plugin.deny[]` array that **every** agent inherits regardless of its bucket —
defense-in-depth for secrets and footguns. The shipped baseline:

```
Read(./.env)            Read(./.env.*)         Read(./secrets/**)
Read(./credentials.json)  Read(./credentials.*)
Read(~/.ssh/**)         Read(~/.aws/**)        Read(~/.gnupg/**)
Bash(rm -rf /)          Bash(rm -rf ~)         Bash(rm -rf /*)
Bash(curl * | sh)       Bash(curl * | bash)
Bash(wget * | sh)       Bash(wget * | bash)
```

Projection:

- **Claude:** enforced at runtime by the plugin **PreToolUse hook**
  `.claude-plugin/hooks/pre-tool-use-deny.sh`. Claude plugins cannot declare a
  plugin-level deny (plugin `settings.json` accepts only `agent`/`subagentStatusLine`;
  no `plugin.json` `permissions` field — `plugins-reference.md:809`), and agent
  `disallowedTools` filters only the tool pool by bare name, not by path/arg
  (`sub-agents.md:269,335`). The PreToolUse hook is the host's own recommended
  mechanism for path/arg-scoped denial (`permissions.md:150-164`): it reads
  `plugin.deny[]` from the manifest at runtime and returns `permissionDecision:"deny"`
  for secret-file reads (`.env`, `secrets/**`, `~/.ssh/**`, …) and destructive Bash
  (`rm -rf /`, `curl … | sh`, plus destructive git: force-push, `reset --hard`,
  `restore`, `checkout --`, `clean -f`). The per-agent `tools` allowlist is the primary
  boundary; this hook is the defense-in-depth deny layer.
  - **`deny` vs `ask`.** The hook also returns `permissionDecision:"ask"` for one
    case: a `git push` to an explicitly-named protected branch (`git push origin main`).
    The distinction is deliberate. `deny` fires ahead of any permission mode and cannot
    be bypassed, which is right for a safety invariant but wrong for a workflow
    *preference* — trunk-based development is a legitimate model, and denying it leaves
    the user prefixing an override forever. `ask` surfaces the normal permission prompt
    and the user decides per call. Destructive checks run first, so
    `git push --force origin main` is denied on the force rather than prompted. The
    judgment behind the prompt lives in `rules/protected-branch-discipline.md`.
  - **Only command-named destinations are checked.** The hook classifies from the
    command text; the tool-call `cwd` is the session directory, not the directory the
    command runs in, so any current-branch resolution is wrong once a command `cd`s
    first — the normal case in a multi-worktree repo. A bare `git push` (destination =
    current branch) and `git commit` are therefore not branch-checked at all.
  - **Known limits:** the hook matches by path basename/segment
    and literal command pattern, so it guards against accidental/model-driven
    leaks, not a determined adversary — symlink/realpath indirection and shell
    token-splitting (`rm$IFS-rf /`, base64-decode-pipe) can evade it. These gaps are
    recorded as known-allow cases in `scripts/test-deny-hook.mjs`; realpath
    normalization and shell-token canonicalization remain deferred to a future
    hardening pass. The
    host-enforced `tools` allowlist remains the real boundary regardless.
- **OpenCode:** into the global `permission` block (`read.{**/.env: deny, ...}`,
  applied to all agents — not redeclared per agent).

(Decision D5, corrected — see `decisions.md` §D5 correction note. The original D5
assumed a Claude plugin-level deny the host does not support; a per-agent
`disallowedTools` attempt was also rejected as theater/breaking before the hook.)

> **`Task` is inert for plugin subagents on Claude.** The manifest grants `Task`
> to `orchestrator`, `subagent-executor`, and `ultra-worker`, but `Agent`/`Task`
> is unavailable to subagents even when listed in `tools` (`sub-agents.md:306-308`),
> and subagents cannot spawn subagents (`:359`). On Claude, orchestration happens
> from the primary session, not a dispatched subagent — so read the audit's `Task`
> grant as "meaningful on OpenCode; inert on Claude," not "this agent can fan out
> on Claude."

## Prose-vs-declared drift lint

Several agent bodies make explicit read-only claims. The drift lint in
`scripts/validate-structure.mjs` (module `scripts/lib/validate-permissions.mjs`)
regex-scans agent bodies for phrases like `read-only`, `Read/Glob/Grep only`,
`no shell access`, `no Write`, `no Edit`, and **warns when the body's claim
contradicts the declared grant**. It also verifies that the projected Claude
`tools:` matches the manifest (drift there is an error, not a warning).

To keep an agent consistent: if the body says "read-only," the manifest entry must
be an RO-family bucket, and the optional `prose` field should quote the body's
claim so the assertion is exact. If you promote an agent, update the body prose
in the same change. (Decision D7.)

## What is *not* projected: `permissionMode`

Aegis does **not** project `permissionMode` (`acceptEdits` / `plan` / `auto`) per
agent. Claude Code's plugin loader silently strips `permissionMode` from
plugin-shipped agents, and there's no warning surface to flag the drop. Rather
than emit a field that silently dies (or worse, looks like it works), Aegis omits
it entirely — users set permission mode at the session level. (Decision D9.)

## Worked examples

### A read-only agent: `code-quality-reviewer` (bucket RO)

```json
"code-quality-reviewer": {
  "bucket": "RO",
  "claude": { "tools": ["Read", "Grep", "Glob"] },
  "opencode": {
    "*": "deny", "read": "allow", "grep": "allow", "glob": "allow", "list": "allow"
  },
  "justification": "Stage 2 reviewer; hard read-only per body.",
  "prose": "Your only tools are Read, Glob, and Grep. You do not write, edit, or execute anything."
}
```

- **Claude:** `adapters/claude/agents/code-quality-reviewer.md` gets
  `tools: [Read, Grep, Glob]`. It cannot Edit, Write, or run Bash.
- **OpenCode:** `opencode.json` gets `agent.code-quality-reviewer.permission`
  denying everything except read/grep/glob/list.
- **Drift lint:** the `prose` field matches the body's claim, so the assertion
  passes. Change the body to allow edits without updating the bucket and the lint
  warns.
- **Codex/Cursor/Zed:** advisory — the reviewer *should* stay read-only, but the
  host won't stop it.

### An elevated agent: `build-error-resolver` (bucket RW-bash)

```json
"build-error-resolver": {
  "bucket": "RW-bash",
  "claude": {
    "tools": [
      "Read", "Edit", "Grep", "Glob",
      "Bash(npm *)", "Bash(bun *)", "Bash(pnpm *)", "Bash(node *)", "Bash(tsc *)",
      "Bash(go build*)", "Bash(go vet*)", "Bash(cargo check*)", "Bash(cargo build*)"
    ]
  },
  "opencode": {
    "*": "deny", "read": "allow", "grep": "allow", "glob": "allow", "list": "allow",
    "edit": "allow",
    "bash": { "*": "deny", "npm *": "allow", "bun *": "allow", "pnpm *": "allow",
              "node *": "allow", "tsc *": "allow", "go build*": "allow",
              "go vet*": "allow", "cargo check*": "allow", "cargo build*": "allow" }
  },
  "justification": "Runs build/typecheck, applies minimal fix, re-runs build; needs Edit + Bash scoped to build commands."
}
```

- **Claude:** gets `Edit` plus a **scoped** Bash allowlist — it can run
  `npm run build` but not `rm` or `curl`. The plugin-level deny still blocks
  `Bash(rm -rf /)` etc. on top of this.
- **OpenCode:** `edit: allow` and a `bash` map that denies `*` then re-allows only
  the build runners.
- **No `Write`:** this agent edits existing files, it doesn't scaffold new ones —
  so `Write` is deliberately absent.
- **Codex/Cursor/Zed:** advisory.

## See also

- `manifest/permissions.json` — the data (single source of truth).
- `manifest/schemas/permissions.schema.json` — the schema.
- `.aegis/audits/agent-permissions.md` — committed snapshot of all 18 agents for
  PR-diff visibility.
- `.aegis/specs/features/ag-0008-agent-permissions/decisions.md` — D1–D10.
- `adapters/claude/projection.md`, `adapters/opencode/projection.md` — host
  projection detail.
