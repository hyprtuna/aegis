#!/usr/bin/env node
// build-dist-zip.mjs — build dist/aegis.skill, a reproducible ZIP of the
// projected Claude plugin tree, loadable via `claude --plugin-url`.
//
// Reproducibility:
//   - Files added in a stable sorted order.
//   - Fixed mtime (DOS epoch 1980-01-01 00:00:00) on every entry.
//   - No .DS_Store / .git / node_modules / references / dist / .opencode / .codex*.
//   - Deflate via node:zlib (deflateRawSync); store fallback when deflate is
//     not smaller. Deterministic → byte-identical across runs.
//
// Node 20+ stdlib only. A minimal ZIP writer is implemented inline (local file
// headers + central directory + EOCD) — no third-party zip dependency.
//
// On-demand only: NOT invoked by scripts/project.mjs.

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { join, relative, sep } from "node:path";
import { deflateRawSync, crc32 } from "node:zlib";
import { createHash } from "node:crypto";

const REPO = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const OUT_DIR = join(REPO, "dist");
const OUT_PATH = join(OUT_DIR, "aegis.skill");

// Top-level dirs/files a Claude plugin install needs. Anything not listed is
// excluded (.opencode/, .codex*, .aegis/, references/, node_modules, dist, .git).
const INCLUDE = [
  ".claude-plugin",
  "adapters/claude",
  "skills",
  "agents",
  "commands",
  "rules",
  "hooks",
  "templates",
  "statuslines",
  "manifest",
];

const EXCLUDE_NAMES = new Set([
  ".DS_Store",
  ".git",
  "node_modules",
  "references",
  "dist",
  ".opencode",
  ".codex",
  ".codex-plugin",
  ".aegis",
]);

// Recursively collect files under `abs`, returning repo-relative POSIX paths.
function walk(abs, out) {
  if (!existsSync(abs)) return;
  const st = statSync(abs);
  if (st.isFile()) {
    out.push(relative(REPO, abs).split(sep).join("/"));
    return;
  }
  if (!st.isDirectory()) return;
  for (const entry of readdirSync(abs).sort()) {
    if (EXCLUDE_NAMES.has(entry)) continue;
    walk(join(abs, entry), out);
  }
}

function collectFiles() {
  const files = [];
  for (const top of INCLUDE) walk(join(REPO, top), files);
  // Stable, deterministic order independent of FS enumeration.
  files.sort();
  return files;
}

// ── Minimal ZIP writer ──────────────────────────────────────────────────────
// DOS date/time for 1980-01-01 00:00:00 → both fields zero except the date,
// which encodes year-1980=0, month=1, day=1 → 0x0021.
const DOS_TIME = 0;
const DOS_DATE = 0x0021;

function buildZip(entries) {
  // entries: [{ name, data }]
  const localChunks = [];
  const central = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, "utf8");
    const crc = crc32(data) >>> 0;
    const deflated = deflateRawSync(data, { level: 9 });
    const useDeflate = deflated.length < data.length;
    const method = useDeflate ? 8 : 0;
    const body = useDeflate ? deflated : data;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header sig
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18); // compressed size
    local.writeUInt32LE(data.length, 22); // uncompressed size
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // extra len
    localChunks.push(local, nameBuf, body);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); // central dir sig
    cd.writeUInt16LE(20, 4); // version made by
    cd.writeUInt16LE(20, 6); // version needed
    cd.writeUInt16LE(0, 8); // flags
    cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(DOS_TIME, 12);
    cd.writeUInt16LE(DOS_DATE, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(body.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30); // extra len
    cd.writeUInt16LE(0, 32); // comment len
    cd.writeUInt16LE(0, 34); // disk number
    cd.writeUInt16LE(0, 36); // internal attrs
    cd.writeUInt32LE(0, 38); // external attrs
    cd.writeUInt32LE(offset, 42); // local header offset
    central.push(cd, nameBuf);

    offset += local.length + nameBuf.length + body.length;
  }

  const localBuf = Buffer.concat(localChunks);
  const centralBuf = Buffer.concat(central);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD sig
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // central dir start disk
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(localBuf.length, 16); // central dir offset
  eocd.writeUInt16LE(0, 20); // comment len

  return Buffer.concat([localBuf, centralBuf, eocd]);
}

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function main() {
  const files = collectFiles();
  if (files.length === 0) {
    console.error("No files collected — did the Claude projection run? (adapters/claude/ empty)");
    process.exit(1);
  }
  const entries = files.map((name) => ({ name, data: readFileSync(join(REPO, name)) }));
  const zip = buildZip(entries);

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_PATH, zip);

  console.log(`Wrote ${OUT_PATH}`);
  console.log(`  files: ${entries.length}`);
  console.log(`  bytes: ${zip.length}`);
  console.log(`  sha256: ${sha256(zip)}`);
}

main();
