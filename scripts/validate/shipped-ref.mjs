// shipped-ref.mjs — guards the pre-launch residue sweep: warns when a shipped
// tracked file carries a ticket reference or a pre-launch internal version
// stamp that should never have reached the public tree.
//
// Two independent checks, reusing the shared ctx walk (no second walk):
//   1. `AG-[0-9]{4}` (uppercase ticket ids), boundary-guarded so an
//      acronym-suffixed token like `TAG-2024`/`DIAG-1234`/`FLAG-0001` does
//      NOT match — flagged in ALL scanned files. Case-sensitive by design:
//      a lowercase `ag-NNNN/` path-citation form never matches this pattern
//      either way.
//   2. Pre-launch internal version stamp `v0.(0|2|3).N` — flagged in `.md`
//      files ONLY. Public host-version refs (`v2.1.105`) and the current
//      public series (`v0.1.x`) never match. Non-`.md` code-comment stamps
//      (`.mjs`/`.template.json`) are deliberately out of scope for now — see
//      the graduation note below.
//
// The ctx walk (scripts/validate/_context.mjs) skips dot-dirs EXCEPT
// `.claude-plugin`, which it deliberately walks because it ships real
// projected content. The private planning repo is not walked at all, so this
// rule needs no exemption for it. This module excludes `CHANGELOG.md` (public
// history starts at v0.1.0) and the whole `scripts/tests/` directory, which
// legitimately plants example `AG-NNNN` / `v0.x.y` strings as test fixtures
// (including this rule's own unit test). `.claude-plugin/` is left
// unexempted: it is generated from already-scrubbed canonical and carries no
// AG refs post-scrub (verified via `git grep`) — if that ever changes, fix the
// canonical source, not this rule.
export const id = "SHIPPED_REF";

const AG_REF = /(?<![A-Za-z0-9])AG-[0-9]{4}\b/;
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
  // "v0." prefix here for a different reason than it might look — this file
  // is a .mjs module, not .md, so VERSION_STAMP's .md-only scope already makes
  // this line self-safe regardless of wording; the "0.2.0" spelling is kept
  // anyway so the docs/validators.md prose copy of this same sentence, which
  // IS a scanned .md file, stays self-safe too).
  return `${rel}:${lineNo} contains a pre-launch reference "${token}" — scrub ticket ids / internal version stamps from shipped content (warn-only; graduates to hard-fail in the 0.2.0 release). [SHIPPED_REF]`;
}
