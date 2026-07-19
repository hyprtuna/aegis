// claude-md — count of CLAUDE.md/AGENTS.md context files.
//
// FILESYSTEM-derived, NOT transcript-derived: walks from the session's cwd
// upward to the repo root (short-circuiting at the first `.git` directory
// found, bounded by MAX_DEPTH as a hard safety cap against a symlink loop or
// pathological nesting) plus the user-level `~/.claude/CLAUDE.md`, using cheap
// existsSync checks. Because it never reads ctx.transcript, this segment is
// intentionally excluded from runtime.mjs's transcript-segment gate (D6) — it
// costs nothing extra to include on any preset. Renders `2 CLAUDE.md`; null
// when the cwd is unknown, the walk finds nothing, or any lookup throws.
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";

const MAX_DEPTH = 25;
const FILE_NAMES = ["CLAUDE.md", "AGENTS.md"];

function safeExists(path) {
  try {
    return existsSync(path);
  } catch {
    return false;
  }
}

function countUpward(startDir) {
  let count = 0;
  let dir = resolve(startDir);
  let prev = null;
  for (let i = 0; i < MAX_DEPTH && dir !== prev; i++) {
    for (const name of FILE_NAMES) {
      if (safeExists(join(dir, name))) count += 1;
    }
    if (safeExists(join(dir, ".git"))) break; // repo root reached — stop walking
    prev = dir;
    dir = dirname(dir);
  }
  return count;
}

export function render(ctx) {
  try {
    const cwd = ctx.data?.workspace?.current_dir || ctx.data?.cwd;
    if (!cwd || typeof cwd !== "string") return null;

    let count = countUpward(cwd);
    if (safeExists(join(homedir(), ".claude", "CLAUDE.md"))) count += 1;

    if (count <= 0) return null;
    return ctx.color(`${count} CLAUDE.md`, "muted");
  } catch {
    return null;
  }
}
