// template-index.mjs — section: integrity of manifest/template-index.json
// against on-disk template bodies and the per-template slot manifests.
//
// Checks:
//   1. Path existence (ERROR) — every formats.{html,markdown,json} path in the
//      index resolves to a file that exists on disk.
//   2. Default present (ERROR) — each kind's `default` format key is present in
//      that kind's `formats` object.
//   3. Orphan bodies (WARN) — every templates/{html,markdown,json}/** body file
//      (excluding .template.json manifests + AGENTS/CLAUDE) should be referenced
//      by some index entry. Unreferenced bodies are WARN, not ERROR: variant
//      bodies (minimal.md, decisions/opencode.md, the project/ family,
//      json/decisions/claude-code.json) are intentionally not yet registered —
//      they graduate to index entries (and the warning to a hard error) as later
//      release phases register their kinds.
//   4. Slot↔body cross-check (ERROR) — for each template body with a sibling
//      <name>.template.json, this is a FULL-PATH 1:1 correspondence check
//      (v0.0.12). It enforces the slot-declaration convention documented
//      in templates/AGENTS.md ("Slot-declaration convention"):
//        - forward: every declared slot key appears in the body. An array slot
//          `<base>[]` is satisfied by either a `<base>` repeat marker OR any
//          `<base>.<field>` field marker; a scalar/dotted slot key must match a
//          marker EXACTLY (`[]`-stripped).
//        - orphan: every body marker matches a declared slot key by full path
//          (`[]`-stripped) — a dotted marker `<base>.<field>` must match an exact
//          dotted slot key OR be a field of a declared collection (`<base>[]`
//          slot or `<base>[]` shape). A bogus sub-path (`{{ slot.title.headline }}`
//          when only the scalar slot `title` is declared) is now an ERROR.
//        - shape arrays required (HTML/MD): every `shape` array key `<base>[]`
//          must be wired into the body — a `<base>` marker base must exist, or
//          `<base>` must be nested inside another shape value (e.g. `items: item[]`
//          inside `column[]`). JSON bodies use the flattened-field convention
//          (a `finding[]` shape flattens to camelCase scalar slots like
//          `findingSeverity`), so JSON `shape` keys are DOCUMENTARY and exempt
//          from the body-presence requirement — they are still subject to the
//          full-path orphan rule.
// The two former false-negatives (baseKey truncation; shape-never-required) are
// closed: keys are compared on their FULL `[]`-stripped path, and HTML/MD shape
// arrays are required to appear. Schema-level rules in
// manifest/schemas/template-index.schema.json (default∈formats, formats path
// prefixes) are NOT executed here (no ajv, stdlib-only) — they are documentation.
import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import { htmlSlotRegex, isTemplateBodySkipped } from "./_context.mjs";

export const id = "TEMPLATE_INDEX";

const FORMATS = ["html", "markdown", "json"];

// Strip a trailing `[]` only — keep the full dotted path (`callSequence.location`
// stays intact; `callSequence[]` -> `callSequence`).
function norm(k) {
  return (k || "").replace(/\[\]$/, "");
}
// The leading segment (before the first `.`), `[]`-stripped.
function baseSeg(k) {
  return norm(k).split(".")[0];
}

// Collect the set of FULL marker keys from a body, per family (`[]`-stripped).
//   html:     <!-- SLOT: key ... -->        (shared regex; key class includes `-`)
//   markdown: {{ slot.key }} OR {{ key }}    (both forms accepted — on-disk reality)
//   json:     __SLOT__key
function markerKeys(family, text) {
  const out = new Set();
  let re, m;
  if (family === "html") {
    re = htmlSlotRegex();
  } else if (family === "markdown") {
    re = /\{\{\s*(?:slot\.)?([a-zA-Z][a-zA-Z0-9_.\[\]-]*)\s*\}\}/g;
  } else {
    re = /__SLOT__([a-zA-Z][a-zA-Z0-9_.]*)/g;
  }
  while ((m = re.exec(text)) !== null) out.add(norm(m[1]));
  return out;
}

// Singular collection names referenced WITHIN a shape value string as `name[]`
// (e.g. `{ name: string, items: item[] }` references `item`). Used so a nested
// element shape (`item[]`) that documents a field of another collection
// (`column[]`) is not flagged as an unwired array.
function shapeNestedNames(shape) {
  const out = new Set();
  for (const v of Object.values(shape || {})) {
    const hits = String(v).match(/([A-Za-z_][A-Za-z0-9_]*)\[\]/g) || [];
    for (const h of hits) out.add(h.replace(/\[\]$/, ""));
  }
  return out;
}

export function run(ctx) {
  const { REPO, walk, read } = ctx;
  const errors = [];
  const warnings = [];

  const indexPath = join(REPO, "manifest", "template-index.json");
  if (!existsSync(indexPath)) {
    errors.push("missing manifest/template-index.json (required by the ${TEMPLATE} resolver).");
    return { errors, warnings };
  }
  let index;
  try {
    index = JSON.parse(read(indexPath));
  } catch (e) {
    errors.push(`manifest/template-index.json invalid JSON: ${e.message}`);
    return { errors, warnings };
  }
  if (!index.kinds || typeof index.kinds !== "object") {
    errors.push("manifest/template-index.json: missing object property `kinds`.");
    return { errors, warnings };
  }

  // Set of repo-relative body paths the index references (for the orphan check).
  const referenced = new Set();

  // Checks 1 + 2.
  // designOnly (v0.0.9): a kind flagged `designOnly: true` ships as a
  // design reference with no near-term producer — an EXPECTED orphan. This file
  // checks body/path integrity (1, 2, 4) and orphan BODIES (3), none of which
  // is producer-coverage, so designOnly does not change those checks; the
  // producer-coverage warning lives in named-artifact-template.mjs (which is
  // producer-side and never sees a producerless kind). The extra `designOnly`
  // key is tolerated here (only `.formats`/`.default` are read). Recorded so a
  // future kind-coverage check added here keeps designOnly kinds exempt.
  for (const [kind, entry] of Object.entries(index.kinds)) {
    if (!entry || typeof entry !== "object") {
      errors.push(`template-index kind '${kind}': entry must be an object.`);
      continue;
    }
    const formats = entry.formats || {};
    // Check 2 — default present in formats.
    if (!entry.default || !(entry.default in formats)) {
      errors.push(
        `template-index kind '${kind}': default '${entry.default}' is not a key in formats ` +
          `(formats: ${Object.keys(formats).join(", ") || "none"}).`,
      );
    }
    // Check 1 — every formats path exists.
    for (const fmt of FORMATS) {
      const rel = formats[fmt];
      if (rel == null) continue;
      referenced.add(rel);
      if (!existsSync(join(REPO, rel))) {
        errors.push(`template-index kind '${kind}' format '${fmt}': path does not exist on disk: ${rel}`);
      }
    }
  }

  // Checks 3 + 4 — walk every template body once.
  const templatesRoot = join(REPO, "templates");
  if (existsSync(templatesRoot)) {
    const BODY_EXT = /\.(html|md|json)$/;
    for (const family of FORMATS) {
      const familyDir = join(templatesRoot, family);
      if (!existsSync(familyDir)) continue;
      for (const file of walk(familyDir)) {
        const base = file.replace(/^.*\//, "");
        if (isTemplateBodySkipped(base)) continue; // guidance/readme prose + sibling manifests
        if (!BODY_EXT.test(base)) continue;

        const rel = relative(REPO, file);

        // Check 3 — orphan body (WARN).
        if (!referenced.has(rel)) {
          warnings.push(
            `template body not registered in manifest/template-index.json (variant/unported — ` +
              `becomes a hard error once its kind is indexed): ${rel}`,
          );
        }

        // Check 4 — slot↔body cross-check. Only runs when a sibling manifest
        // exists (the missing-manifest case is owned by the TEMPLATES rule).
        const manifestPath = file.replace(BODY_EXT, ".template.json");
        if (!existsSync(manifestPath)) continue;
        let manifest;
        try {
          manifest = JSON.parse(read(manifestPath));
        } catch {
          // Malformed manifest is reported by the TEMPLATES rule; skip here.
          continue;
        }
        const slots = Array.isArray(manifest.slots) ? manifest.slots : [];
        const shape = manifest.shape || {};

        // Declared slot keys, `[]`-stripped (full dotted path preserved).
        const slotExact = new Set(slots.map((s) => norm(s.key || "")).filter(Boolean));
        // Bases of ARRAY slots (`<base>[]`) — these accept `<base>` or `<base>.<field>` markers.
        const slotArrayBases = new Set(
          slots.filter((s) => /\[\]$/.test(s.key || "")).map((s) => baseSeg(s.key || "")).filter(Boolean),
        );
        // Bases of `shape` ARRAY keys, and the singular names nested in other shape values.
        const shapeArrayBases = new Set(
          Object.keys(shape).filter((k) => /\[\]$/.test(k)).map(baseSeg),
        );
        const shapeNested = shapeNestedNames(shape);
        // Collection bases that legitimately carry `<base>.<field>` field markers:
        // array slots + array shapes.
        const collectionBases = new Set([...slotArrayBases, ...shapeArrayBases]);

        const markers = markerKeys(family, read(file));
        const markerBases = new Set([...markers].map(baseSeg));

        // Forward: every declared slot key must appear in the body (full-path).
        for (const s of slots) {
          const k = norm(s.key || "");
          if (!k) continue;
          if (/\[\]$/.test(s.key || "")) {
            // Array slot: satisfied by a `<base>` repeat marker OR any `<base>.<field>` field marker.
            const b = baseSeg(s.key || "");
            if (markers.has(b) || markerBases.has(b)) continue;
            errors.push(
              `template slot↔body mismatch in ${rel}: array slot '${s.key}' has no matching ` +
                `${family} marker (neither '${b}' nor '${b}.<field>') in the body.`,
            );
          } else {
            // Scalar/dotted slot: exact full-path marker required.
            if (markers.has(k)) continue;
            errors.push(
              `template slot↔body mismatch in ${rel}: slot '${s.key}' has no matching ` +
                `${family} marker '${k}' in the body.`,
            );
          }
        }

        // Orphan markers (full-path): every body marker must correspond to a declared key.
        for (const mk of markers) {
          if (slotExact.has(mk)) continue; // exact slot key (scalar or dotted)
          const b = baseSeg(mk);
          if (!mk.includes(".")) {
            // Bare marker: a collection-base repeat (`<base>` for `<base>[]`) is valid.
            if (collectionBases.has(mk)) continue;
          } else {
            // Dotted marker `<base>.<field>`: valid as a field of a declared collection.
            if (collectionBases.has(b)) continue;
          }
          errors.push(
            `template orphan marker in ${rel}: body marker '${mk}' has no full-path match in the ` +
              `sibling manifest (not a declared slot key, nor a field of a declared array slot/shape).`,
          );
        }

        // Shape arrays required in the body (HTML/MD). JSON `shape` is documentary
        // (flattened-field convention), so it is exempt from this presence check.
        if (family !== "json") {
          for (const sk of Object.keys(shape)) {
            if (!/\[\]$/.test(sk)) continue; // non-array shape (e.g. a single object) — documentary
            const sb = baseSeg(sk);
            if (markerBases.has(sb)) continue; // wired via `<sb>` or `<sb>.<field>` marker
            if (shapeNested.has(sb)) continue; // nested element of another collection (e.g. item[] in column[])
            errors.push(
              `template shape array unused in ${rel}: shape '${sk}' declares a collection but no ` +
                `${family} marker uses base '${sb}' (and it is not nested in another shape).`,
            );
          }
        }
      }
    }
  }

  return { errors, warnings };
}
