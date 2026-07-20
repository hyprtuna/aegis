---
name: aegis-doctor
description: Use to run an Aegis health check — confirm rules loaded, count them, and spot rules that declared a paths condition but never matched.
visibility: user
platforms: [claude, opencode, codex, cursor, zed]
---

# Aegis Doctor

Run a quick health check on an Aegis install: how many guidance files loaded into
this session, and whether any rule declared a `paths:` condition that never matched.
This skill reads the tally that the `instructions-loaded` hook writes during the
session; on hosts without that hook it falls back to a static structure check.

## What the InstructionsLoaded hook records

Claude Code fires `InstructionsLoaded` once for each `CLAUDE.md` or
`.claude/rules/*.md` file as it enters context — at session start and again on lazy
loads. The Aegis hook (`.claude-plugin/hooks/instructions-loaded.sh`) appends one
line per load to a session-scoped tally and reports a running summary back as
advisory context. Each line records four fields:

- `load_reason` — `session_start`, `nested_traversal`, `path_glob_match`, `include`, or `compact`.
- `memory_type` — `User`, `Project`, `Local`, or `Managed`.
- a silent-drop flag — `yes` when the load reason was `path_glob_match` but no glob was recorded.
- `file_path` — the absolute path that loaded.

A `path_glob_match` load with no recorded glob is the signal the doctor cares about:
a rule declared a `paths:` activation condition yet contributed nothing. That points
at a typo in the rule's frontmatter glob, or a rule scoped to files this project does
not have.

## Read the loaded-rules count and silent drops

The tally lives at `${TMPDIR:-/tmp}/aegis-doctor/<session_id>.instructions`. Read it
directly when you have shell access:

```bash
TALLY="${TMPDIR:-/tmp}/aegis-doctor/${CLAUDE_SESSION_ID:-default}.instructions"
if [ -f "$TALLY" ]; then
  printf 'Rule files loaded: %s\n' "$(wc -l < "$TALLY" | tr -d ' ')"
  printf 'Silent drops (paths: declared, no glob match): %s\n' \
    "$(awk -F'\t' '$3=="yes"{c++} END{print c+0}' "$TALLY")"
  echo '--- drops ---'
  awk -F'\t' '$3=="yes"{print $4}' "$TALLY"
else
  echo 'No tally yet — the InstructionsLoaded hook has not fired this session.'
fi
```

The hook also reports the same count and drop total as advisory context after each
load, so the figures are visible without reading the file.

## Run a health check

1. Read the tally (above) for the loaded-rules count and the drop list.
2. If the count is `0`, the `instructions-loaded` hook did not fire — confirm the
   plugin is installed and `.claude-plugin/plugin.json` lists the `InstructionsLoaded`
   hook. On OpenCode, Codex, Cursor, and Zed this hook is a documented gap, so fall
   back to step 4.
3. For each silent drop, open the named file and check its `paths:` frontmatter:
   verify the glob is well-formed and that the project actually contains files it
   should match.
4. Static fallback (any host): run `node scripts/validate-structure.mjs` to confirm
   the surface tree is intact, and `node scripts/inventory.mjs` for surface counts.

## What this skill does not do

- It does not modify rules or plugin config — it reports.
- It does not block any session event. The `instructions-loaded` hook is
  observability only and cannot stop a file from loading.
- It does not guarantee a drop is a bug: a rule scoped to a language the project does
  not use will show as a drop and that is correct behaviour.
