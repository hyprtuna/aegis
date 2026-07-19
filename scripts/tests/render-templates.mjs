#!/usr/bin/env node
// render-templates.mjs — per-template render harness (pulled into v0.0.8).
//
// Node + stdlib only. No browser, no happy-dom. For each template body under
// templates/{html,markdown,json}/ that has a sibling <name>.template.json:
//   1. Load the slot manifest.
//   2. Build a fixture payload from the manifest (slot description/enum examples
//      + shape keys), one value per base slot key.
//   3. Substitute every family-native marker in the body with its fixture value.
//   4. Assert: every REQUIRED slot's base key was supplied a fixture value, and
//      no residual markers (<!-- SLOT: --> / {{ slot.x }} / {{x}} / __SLOT__x)
//      remain after substitution.
// Then iterate manifest/template-index.json and confirm every registered
// kind×format body renders (resolves to a body that substitutes cleanly).
//
// Exits non-zero on any failure. Total runtime budgeted well under 30s.

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
// Shared SLOT regex + skip-list — single source of truth, so the gate
// (scripts/validate/template-index.mjs) and this render harness can never diverge
// on hyphenated keys or on which files count as template bodies.
import { htmlSlotRegex, isTemplateBodySkipped } from "../validate/_context.mjs";

const REPO = new URL("..", import.meta.url).pathname.replace(/\/scripts\/?$/, "");
const ROOT = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const start = Date.now();

const FORMATS = ["html", "markdown", "json"];
let failures = 0;
let rendered = 0;

function fail(msg) {
  console.error("  ✗ " + msg);
  failures++;
}

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

function baseKey(k) {
  return k.replace(/\[\]$/, "").split(".")[0].replace(/\[\]$/, "");
}

// Marker regex per family (matches the family-native form, capturing the key).
// HTML uses the shared `htmlSlotRegex()` from _context.mjs (key class includes
// `-`); the comment annotation after the key (which may carry `<`, `>`, `(`, `)`)
// is consumed non-greedily up to `-->`.
function markerRegex(family) {
  if (family === "html") return htmlSlotRegex();
  if (family === "markdown") return /\{\{\s*(?:slot\.)?([a-zA-Z][a-zA-Z0-9_.\[\]-]*)\s*\}\}/g;
  return /__SLOT__([a-zA-Z][a-zA-Z0-9_.]*)/g;
}

// A loose "any residual marker" regex (family-independent) for the final assert.
const RESIDUAL = {
  html: /<!--\s*SLOT:/,
  markdown: /\{\{\s*(?:slot\.)?[a-zA-Z]/,
  json: /__SLOT__/,
};

// Build a fixture value for a base key. Prefer enum first value; else a tagged
// placeholder so substitution is visible and assertions are unambiguous.
function fixtureFor(baseK, slotsByBase) {
  const slot = slotsByBase.get(baseK);
  if (slot && Array.isArray(slot.enum) && slot.enum.length > 0) return slot.enum[0];
  return `[fixture:${baseK}]`;
}

function renderBody(family, body, manifest, relPath) {
  const slots = Array.isArray(manifest.slots) ? manifest.slots : [];
  const slotsByBase = new Map();
  for (const s of slots) {
    const b = baseKey(s.key || "");
    if (b && !slotsByBase.has(b)) slotsByBase.set(b, s);
  }
  const requiredBases = new Set(
    slots.filter((s) => s.required !== false).map((s) => baseKey(s.key || "")).filter(Boolean),
  );

  // Discover every base key actually present as a marker in the body.
  const seen = new Set();
  const re = markerRegex(family);
  let m;
  while ((m = re.exec(body)) !== null) seen.add(baseKey(m[1]));

  // Substitute every marker with its fixture value.
  const out = body.replace(markerRegex(family), (_full, key) => fixtureFor(baseKey(key), slotsByBase));

  // Assert: every required slot base key was present in the body (so it got filled).
  for (const rb of requiredBases) {
    if (!seen.has(rb)) {
      fail(`${relPath}: required slot base '${rb}' has no marker in the body (cannot be filled).`);
    }
  }
  // Assert: no residual markers remain.
  if (RESIDUAL[family].test(out)) {
    fail(`${relPath}: residual ${family} marker remains after substitution.`);
  }
  return out;
}

// ── Pass 1: every body with a sibling manifest renders ──────────────────────
console.log("Render harness — per-body slot substitution");
const templatesRoot = join(ROOT, "templates");
const BODY_EXT = /\.(html|md|json)$/;
const bodyByRel = new Map(); // relPath -> { family, abs }
const renderedHtmlByName = new Map(); // <kind>.html basename -> rendered output (UX assertions)
for (const family of FORMATS) {
  for (const file of walk(join(templatesRoot, family))) {
    const base = file.replace(/^.*\//, "");
    if (isTemplateBodySkipped(base)) continue; // guidance/readme prose + sibling manifests
    if (!BODY_EXT.test(base)) continue;
    const rel = relative(ROOT, file);
    bodyByRel.set(rel, { family, abs: file });
    const manifestPath = file.replace(BODY_EXT, ".template.json");
    if (!existsSync(manifestPath)) {
      fail(`${rel}: missing sibling manifest (${base.replace(BODY_EXT, ".template.json")}).`);
      continue;
    }
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch (e) {
      fail(`${rel}: sibling manifest invalid JSON (${e.message}).`);
      continue;
    }
    const out = renderBody(family, readFileSync(file, "utf8"), manifest, rel);
    if (family === "html") renderedHtmlByName.set(base, out);
    rendered++;
  }
}

// ── Pass 2: every registered kind×format in the index renders ───────────────
console.log("Render harness — index kind×format coverage");
const indexPath = join(ROOT, "manifest", "template-index.json");
if (!existsSync(indexPath)) {
  fail("manifest/template-index.json missing.");
} else {
  let index;
  try {
    index = JSON.parse(readFileSync(indexPath, "utf8"));
  } catch (e) {
    fail(`manifest/template-index.json invalid JSON (${e.message}).`);
    index = { kinds: {} };
  }
  for (const [kind, entry] of Object.entries(index.kinds || {})) {
    const formats = entry.formats || {};
    for (const fmt of FORMATS) {
      const rel = formats[fmt];
      if (rel == null) continue;
      const abs = join(ROOT, rel);
      if (!existsSync(abs)) {
        fail(`index ${kind}:${fmt}: body path missing on disk: ${rel}`);
        continue;
      }
      const manifestPath = abs.replace(BODY_EXT, ".template.json");
      if (!existsSync(manifestPath)) {
        fail(`index ${kind}:${fmt}: body ${rel} has no sibling manifest.`);
        continue;
      }
      let manifest;
      try {
        manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      } catch (e) {
        fail(`index ${kind}:${fmt}: manifest invalid JSON (${e.message}).`);
        continue;
      }
      renderBody(fmt, readFileSync(abs, "utf8"), manifest, `${kind}:${fmt} (${rel})`);
    }
  }
}

// ── Pass 3: UX-pattern markers present in the polished HTML templates ───────
// The v0.0.14 HTML UX pattern set (docs/templates.md "HTML UX patterns"): scroll
// anchors (scroll-margin), <details> collapsibles, accent border-left, and an
// eyebrow/subtitle header. These assertions run on the RENDERED output (post
// slot-substitution), so they also prove the patterns survive rendering and are
// not accidentally inside a slot marker. Scoped to the producer-backed kinds that
// v0.0.9 wired producers to — design-only gallery templates are not required to
// carry the full set. Each required pattern is a list of acceptable substrings
// (any one satisfies it), so cosmetic class-name drift does not falsely fail.
console.log("Render harness — HTML UX-pattern markers (producer-backed kinds)");
const UX_REQUIRED = {
  scrollAnchor: ["scroll-margin-top", "scroll-margin"],
  details: ["<details"],
  accentBorder: ["border-left: 4px solid var(--clay)", "border-left:4px solid var(--clay)", "border-left: 4px solid"],
  eyebrow: ['class="eyebrow"', 'class="repo-line"', "<!-- SLOT: eyebrow"],
};
// Producer-backed HTML kinds (v0.0.9 wired producers) that carry the full set.
const UX_PRODUCER_HTML = [
  "research-report.html",
  "plan-audit-report.html",
  "code-review.html",
  "implementation-plan.html",
  "pr-writeup.html",
];
for (const name of UX_PRODUCER_HTML) {
  const out = renderedHtmlByName.get(name);
  if (out == null) {
    fail(`UX markers: ${name} did not render (no HTML output captured).`);
    continue;
  }
  for (const [pattern, accepts] of Object.entries(UX_REQUIRED)) {
    if (!accepts.some((s) => out.includes(s))) {
      fail(`UX markers: ${name} is missing the '${pattern}' pattern (expected one of: ${accepts.join(" | ")}).`);
    }
  }
  // Residual-marker backstop already runs in renderBody; re-assert here so a UX
  // edit that re-introduces an unfilled slot marker fails this pass too.
  if (/<!--\s*SLOT:/.test(out)) {
    fail(`UX markers: ${name} has a residual <!-- SLOT: --> marker after substitution.`);
  }
}

const elapsedMs = Date.now() - start;
if (elapsedMs > 30000) fail(`render harness exceeded 30s budget: ${elapsedMs}ms`);

console.log("");
if (failures > 0) {
  console.error(`Render harness FAILED — ${failures} failure(s), ${rendered} bodies rendered (${elapsedMs}ms).`);
  process.exit(1);
}
console.log(`Render harness passed — ${rendered} bodies rendered, index coverage OK (${elapsedMs}ms).`);
