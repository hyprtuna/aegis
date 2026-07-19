// shipped-ref.mjs — guards the pre-launch residue sweep: warns when a shipped
// tracked file carries a ticket reference or a pre-launch internal version
// stamp that should never have reached the public tree.
//
// Two independent checks, reusing the shared ctx walk (no second walk):
//   1. `AG-[0-9]{4}` (uppercase ticket ids) — flagged in ALL scanned files.
//      Case-sensitive by design: the lowercase `.aegis/specs/features/ag-NNNN/`
//      path-citation form never matches this pattern.
//   2. Pre-launch internal version stamp `v0.(0|2|3).N` — flagged in `.md`
//      files ONLY. Public host-version refs (`v2.1.105`) and the current
//      public series (`v0.1.x`) never match. Non-`.md` code-comment stamps
//      (`.mjs`/`.template.json`) are deliberately out of scope for now — see
//      the graduation note below.
//
// The ctx walk already skips dot-dirs (except `.aegis`/`.claude-plugin`,
// which are dot-dirs excluded from projection anyway) and `references/`.
// This module additionally excludes `CHANGELOG.md` (public history starts at
// v0.1.0) and the whole `scripts/tests/` directory, which legitimately plants
// example `AG-NNNN` / `v0.x.y` strings as test fixtures (including this
// rule's own unit test).
export const id = "SHIPPED_REF";

const AG_REF = /AG-[0-9]{4}/;
const VERSION_STAMP = /\bv0\.(0|2|3)\.\d+/;

// Files this rule never scans, beyond what the shared ctx walk already skips.
function isExempt(rel) {
  if (rel === "CHANGELOG.md") return true;
  if (rel.startsWith("scripts/tests/")) return true;
  return false;
}

export function run(ctx) {
  const { files, rel, read } = ctx;
  const errors = [];
  const warnings = [];

  for (const p of files) {
    const r = rel(p);
    if (isExempt(r)) continue;

    const isMarkdown = r.endsWith(".md");
    const text = read(p);
    const lines = text.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNo = i + 1;

      const agMatch = line.match(AG_REF);
      if (agMatch) {
        warnings.push(shippedRefWarning(r, lineNo, agMatch[0]));
      }

      if (isMarkdown) {
        const versionMatch = line.match(VERSION_STAMP);
        if (versionMatch) {
          warnings.push(shippedRefWarning(r, lineNo, versionMatch[0]));
        }
      }
    }
  }

  return { errors, warnings };
}

function shippedRefWarning(rel, lineNo, token) {
  // Graduation target: hard-fail in the 0.2.0 release (written without the
  // "v0." prefix here on purpose — that exact prefix-plus-digit shape is what
  // VERSION_STAMP itself flags, and this line lives in a scanned .md file).
  return `${rel}:${lineNo} contains a pre-launch reference "${token}" — scrub ticket ids / internal version stamps from shipped content (warn-only; graduates to hard-fail in the 0.2.0 release). [SHIPPED_REF]`;
}
