// skill-siblings.mjs — the single source of truth for which sibling folders of a
// canonical `SKILL.md` are projected verbatim into a host tree.
//
// WHY THIS EXISTS
// ---------------
// The list used to be written out twice inside scripts/project.mjs: once on the
// Claude path (`abilities`, `references`, `rules`) and once on the Codex path
// (`abilities`, `references` — no `rules`). Nothing kept them in agreement, and
// they did not agree: 28 language `rules/*.md` files reached the Claude tree and
// none reached the Codex tree. The drift was invisible because both trees
// generated cleanly and the validator has no cross-host fragment-parity rule.
//
// Two lists that must be identical are one list. This mirrors the posture already
// taken for the Claude hooks block in ./hook-projection.mjs — projection and its
// checks import the same value rather than maintaining mirrors.
//
// Adding a new fragment folder is a one-line edit HERE, and it reaches every host
// at once. Fragments nested inside these folders (e.g. `abilities/<topic>/<x>.md`)
// ride along automatically — the copy walks subdirectories.
//
// Pure data, no I/O. Node 20+ ESM.

export const SKILL_SIBLING_DIRS = ["abilities", "references", "rules"];
