// worktree — dedicated git-worktree indicator.
//
// ADDITIVE, not a replacement: the `git` segment already surfaces the same
// branch-bearing fields as a plain branch indicator (`⎇ <branch>`). This
// segment renders a SEPARATE, distinct line-1 entry (`🌳 wt:<name>`) ONLY
// when the worktree's identifying name (`workspace.git_worktree`) is
// DISTINCT from the branch `git.mjs` already renders (`worktree.branch`
// falling back to `workspace.git_worktree`). When the two values are the
// same string, showing both would double-render the identical name
// (`⎇ feature-x | 🌳 wt:feature-x`), so this segment suppresses itself —
// it renders only when there is genuinely new information to show.
//
// Fields read (same as `git.mjs` — see its header for the full rationale):
// `worktree.branch` (present during a --worktree session), falling back to
// `workspace.git_worktree`, is the BRANCH value git.mjs shows.
// `workspace.git_worktree` is the WORKTREE NAME this segment shows. No
// subprocess: pure stdin-JSON read. Honest gap — both fields are
// host-optional; Claude Code's statusline payload does not guarantee either
// is present, so absence degrades to null (hidden), matching the
// bulletproof-runtime mandate.
const MAX_NAME_LENGTH = 40;

export function render(ctx) {
  try {
    const d = ctx.data || {};
    const ws = d.workspace || {};
    const wt = d.worktree || {};

    const branch = wt.branch || ws.git_worktree; // what git.mjs shows
    const name = ws.git_worktree; // the worktree identifier
    if (!name) return null;

    const clean = ctx.sanitize(String(name)).slice(0, MAX_NAME_LENGTH).trim();
    if (!clean || clean === branch) return null; // suppress when it merely echoes the branch

    return ctx.color(`🌳 wt:${clean}`, "accent");
  } catch {
    return null;
  }
}
