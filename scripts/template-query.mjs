#!/usr/bin/env node
// template-query.mjs — MAINTAINER-ONLY template introspection over
// manifest/template-index.json (AG-0218, v0.0.14 Phase D).
//
// Iron Law 1: this is NOT a user CLI. It is a maintainer helper that answers the
// three discovery questions agents/maintainers ask about the template surface,
// reading ONLY the existing contract (manifest/template-index.json) plus the
// per-kind sibling slot manifests (<body>.template.json). It writes nothing.
//
// Dependency-free Node 20+ stdlib. Output is JSON on stdout (machine-readable per
// scripts/AGENTS.md). Exit 0 on success, non-zero on a bad flag / unknown kind /
// missing index.
//
// ── Usage ────────────────────────────────────────────────────────────────────
//   node scripts/template-query.mjs --kinds-supporting <format>
//       → { "format": "json", "kinds": ["code-review", ...] }
//         every kind whose `formats` map contains <format> (html|markdown|json).
//
//   node scripts/template-query.mjs --formats <kind>
//       → { "kind": "code-review", "default": "markdown",
//           "formats": { "markdown": "...", "html": "...", "json": "..." } }
//         which formats a kind ships and which is its default.
//
//   node scripts/template-query.mjs --slots <kind> [--format <format>]
//       → { "kind": "code-review", "format": "html", "body": "...",
//           "slots": [ { key, type, required, description }, ... ],
//           "shape": { ... } }
//         the slot manifest for a kind's body. Without --format the kind's
//         `default` format is used; --format selects an explicit format body.
//
//   node scripts/template-query.mjs --list
//       → { "kinds": [ { kind, default, formats: [..] }, ... ] }  (all kinds)
//
//   node scripts/template-query.mjs --help        (usage to stderr, exit 0)

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const FORMATS = ["html", "markdown", "json"];

function die(msg, code = 1) {
  process.stderr.write(`template-query: ${msg}\n`);
  process.exit(code);
}

function emit(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + "\n");
  process.exit(0);
}

const USAGE = `template-query.mjs — maintainer template introspection (reads manifest/template-index.json)

  --kinds-supporting <format>   list kinds whose formats include <format> (html|markdown|json)
  --formats <kind>              show a kind's formats map + default
  --slots <kind> [--format f]   show a kind's slot manifest (default format unless --format given)
  --list                        list every kind with its default + available formats
  --help                        this message

Output is JSON on stdout. Maintainer-only (Iron Law 1: not a user CLI).`;

function loadIndex() {
  const path = join(REPO, "manifest", "template-index.json");
  if (!existsSync(path)) die("missing manifest/template-index.json");
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    die(`manifest/template-index.json invalid JSON: ${e.message}`);
  }
  if (!parsed.kinds || typeof parsed.kinds !== "object") {
    die("manifest/template-index.json: missing object property `kinds`");
  }
  return parsed.kinds;
}

function getEntry(kinds, kind) {
  const entry = kinds[kind];
  if (!entry || typeof entry !== "object") {
    die(`unknown kind '${kind}' (not in manifest/template-index.json). Run --list to see kinds.`);
  }
  return entry;
}

// Parse a minimal flag set (no external arg parser).
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") return { help: true };
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        out[key] = true; // boolean flag (e.g. --list)
      } else {
        out[key] = next;
        i++;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

if (args.help || process.argv.length <= 2) {
  process.stderr.write(USAGE + "\n");
  process.exit(0);
}

const kinds = loadIndex();

// ── --kinds-supporting <format> ──────────────────────────────────────────────
if (args["kinds-supporting"] !== undefined) {
  const fmt = args["kinds-supporting"];
  if (fmt === true || !FORMATS.includes(fmt)) {
    die(`--kinds-supporting needs a format (one of: ${FORMATS.join(", ")})`);
  }
  const list = Object.keys(kinds)
    .filter((k) => kinds[k].formats && fmt in kinds[k].formats)
    .sort();
  emit({ query: "kinds-supporting", format: fmt, count: list.length, kinds: list });
}

// ── --formats <kind> ─────────────────────────────────────────────────────────
if (args.formats !== undefined && args.formats !== true) {
  const kind = args.formats;
  const entry = getEntry(kinds, kind);
  emit({
    query: "formats",
    kind,
    default: entry.default || null,
    designOnly: entry.designOnly === true,
    formats: entry.formats || {},
  });
}

// ── --list ───────────────────────────────────────────────────────────────────
if (args.list === true) {
  const list = Object.keys(kinds)
    .sort()
    .map((k) => ({
      kind: k,
      default: kinds[k].default || null,
      designOnly: kinds[k].designOnly === true,
      formats: Object.keys(kinds[k].formats || {}).sort(),
    }));
  emit({ query: "list", count: list.length, kinds: list });
}

// ── --slots <kind> [--format <format>] ───────────────────────────────────────
if (args.slots !== undefined && args.slots !== true) {
  const kind = args.slots;
  const entry = getEntry(kinds, kind);
  const fmt = args.format && args.format !== true ? args.format : entry.default;
  if (!fmt) die(`kind '${kind}' has no default format and no --format was given`);
  if (!FORMATS.includes(fmt)) die(`--format must be one of: ${FORMATS.join(", ")}`);
  const formats = entry.formats || {};
  if (!(fmt in formats)) {
    die(`kind '${kind}' does not ship format '${fmt}' (ships: ${Object.keys(formats).join(", ") || "none"})`);
  }
  const bodyRel = formats[fmt];
  const manifestRel = bodyRel.replace(/\.(html|md|json)$/, ".template.json");
  const manifestAbs = join(REPO, manifestRel);
  if (!existsSync(manifestAbs)) {
    die(`kind '${kind}' format '${fmt}': no sibling manifest at ${manifestRel}`);
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestAbs, "utf8"));
  } catch (e) {
    die(`${manifestRel} invalid JSON: ${e.message}`);
  }
  const slots = Array.isArray(manifest.slots) ? manifest.slots : [];
  emit({
    query: "slots",
    kind,
    format: fmt,
    body: bodyRel,
    manifest: manifestRel,
    slotCount: slots.length,
    slots: slots.map((s) => ({
      key: s.key,
      type: s.type ?? null,
      required: s.required !== false,
      description: s.description ?? null,
    })),
    shape: manifest.shape || {},
  });
}

die(`no recognized query flag. Run --help for usage.`);
