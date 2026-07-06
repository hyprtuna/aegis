// pr — open pull request for the current branch, read entirely from the native
// JSON fields pr.{number,url,review_state} and workspace.repo.{owner,name}.
// NO `gh`/`git` subprocess. `pr` and `pr.review_state` are independently
// optional: when `pr` is absent → render nothing; when present but
// review_state is absent → render the PR without a state badge.
//
// review_state ∈ approved | pending | changes_requested | draft, color-coded
// via the theme:
//   approved           → context (green-ish in default themes)
//   pending            → warning
//   changes_requested  → critical
//   draft              → muted
const STATE_COLOR = {
  approved: "context",
  pending: "warning",
  changes_requested: "critical",
  draft: "muted",
};
const STATE_LABEL = {
  approved: "approved",
  pending: "pending",
  changes_requested: "changes",
  draft: "draft",
};

export function render(ctx) {
  const pr = ctx.data?.pr;
  if (!pr || typeof pr !== "object" || pr.number == null) return null;

  const num = ctx.sanitize(String(pr.number));
  let core = `PR #${num}`;

  // Make the PR number a clickable OSC 8 hyperlink when a url is present.
  const url = typeof pr.url === "string" ? pr.url.trim() : "";
  if (url && /^https?:\/\//.test(url)) {
    const safeUrl = ctx.sanitize(url);
    core = `\x1b]8;;${safeUrl}\x07PR #${num}\x1b]8;;\x07`;
  }

  let out = ctx.color(core, "pr");

  const state = pr.review_state;
  if (typeof state === "string" && STATE_COLOR[state]) {
    out += ctx.color(` (${STATE_LABEL[state]})`, STATE_COLOR[state]);
  }
  return out;
}
