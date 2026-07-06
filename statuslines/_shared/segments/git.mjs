// git — branch / worktree info from the JSON payload.
//
// Claude Code's statusline payload does NOT carry the plain current branch as a
// dedicated field; the documented branch-bearing fields are `worktree.branch`
// (during --worktree sessions) and `workspace.git_worktree` (any linked
// worktree). We render whichever is present, prefixed with a branch glyph.
// No subprocess: the runtime stays pure and fast. Renders null outside a repo /
// when no branch-ish field is present.
export function render(ctx) {
  const d = ctx.data || {};
  const ws = d.workspace || {};
  const wt = d.worktree || {};

  const branch = wt.branch || ws.git_worktree;
  if (!branch) return null;

  return ctx.color(`⎇ ${ctx.sanitize(branch)}`, "git");
}
