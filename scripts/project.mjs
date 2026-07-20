#!/usr/bin/env node
// project.mjs — regenerate host-specific files from canonical content.
//
// v0.0.2: generates `.opencode/agents/` and `.opencode/commands/` from canonical
// `agents/` and `commands/`. Plain Node 20+. No dependencies.
//
// v0.0.3: generates `.codex/plugins/aegis/skills/` (skills + agents-as-skills +
// commands-as-dispatchers) and `.codex-plugin/AGENTS.md` (rules concatenation).
//
// Future:
//   v0.0.4: statusline projection + templates

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, statSync, renameSync, copyFileSync, chmodSync } from "node:fs";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { atomicWrite } from "./lib/atomic-write.mjs";
import { generateClaudeHooksBlock, isHookHelper } from "./lib/hook-projection.mjs";
import { SUBAGENT_PRIMITIVE_KEYS, validateSubagentPrimitive, assertIsolationWritable } from "./lib/subagent-primitives.mjs";

const PKG_VERSION = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).version;

const REPO = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const start = Date.now();

// ─────────────────────────────────────────────────────────────────────────────
// Frontmatter helpers
// ─────────────────────────────────────────────────────────────────────────────

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { fm: {}, body: content };
  const fmRaw = match[1];
  const body = match[2];
  const fm = {};
  // Minimal YAML: top-level key: value or key: [a, b] or key:\n  nested
  let currentKey = null;
  for (const line of fmRaw.split("\n")) {
    const indented = /^\s+\S/.test(line);
    if (!indented) {
      currentKey = null;
      const m = line.match(/^([a-zA-Z][a-zA-Z0-9_-]*):\s*(.*)$/);
      if (!m) continue;
      const [, k, vRaw] = m;
      const v = vRaw.trim();
      if (v === "") {
        fm[k] = {};
        currentKey = k;
      } else if (v.startsWith("[") && v.endsWith("]")) {
        fm[k] = v.slice(1, -1).split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
      } else {
        fm[k] = v.replace(/^['"]|['"]$/g, "");
      }
    } else if (currentKey && typeof fm[currentKey] === "object" && !Array.isArray(fm[currentKey])) {
      const m = line.trim().match(/^([a-zA-Z][a-zA-Z0-9_-]*):\s*(.*)$/);
      if (!m) continue;
      const [, k, vRaw] = m;
      const v = vRaw.trim();
      // Nested values may be inline arrays (`key: [a, b]`) — parse to a real
      // array so x-claude.paths flattens to a YAML sequence on the Claude side.
      if (v.startsWith("[") && v.endsWith("]")) {
        fm[currentKey][k] = v.slice(1, -1).split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
      } else {
        fm[currentKey][k] = v.replace(/^['"]|['"]$/g, "");
      }
    }
  }
  return { fm, body };
}

function emitFrontmatter(fm) {
  const lines = ["---"];
  for (const [k, v] of Object.entries(fm)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      lines.push(`${k}: [${v.map(quoteIfNeeded).join(", ")}]`);
    } else if (typeof v === "object") {
      lines.push(`${k}:`);
      for (const [k2, v2] of Object.entries(v)) {
        lines.push(`  ${k2}: ${quoteIfNeeded(v2)}`);
      }
    } else {
      lines.push(`${k}: ${quoteIfNeeded(v)}`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}

function quoteIfNeeded(v) {
  const s = String(v);
  // Bare-word scalars (no YAML-special chars) emit unquoted. A value that LOOKS
  // like a flow sequence (`[preset]`) must NOT be exempted: real arrays are
  // emitted element-by-element above (emitFrontmatter line ~76), so any bracket-
  // shaped value reaching here is a STRING (e.g. an argument-hint) and must be
  // quoted, else YAML re-reads it as an array (a strict-review fix).
  if (/^[a-zA-Z0-9_./-]+$/.test(s)) return s;
  if (s.includes("'")) return `"${s.replace(/"/g, '\\"')}"`;
  return `'${s}'`;
}

// Re-inject the `> **Invoke via Skill({...})**` / `> **Invoke via Agent({...})**`
// blockquote on the CLAUDE path only (v0.0.10 Phase F). Canonical bodies are now
// host-neutral (the blockquote was relocated to `x-claude.primitiveHint`); the
// projector rebuilds the Claude-specific primitive-disambiguation hint from that
// field and PREPENDS it to the Claude body. OpenCode/Codex/Cursor/Zed get nothing
// (their canonical bodies are already clean — no strip needed).
//
// `hint` is the canonical `x-claude.primitiveHint` value ("skill" | "agent");
// `name` is the aegis surface name (frontmatter `name`). Returns the body
// unchanged when no hint is present (the 35 skills that never carried it).
function injectInvocationBlockquote(body, hint, name) {
  if (hint === "skill") {
    return (
      `> **Invoke via \`Skill({skill: "aegis:${name}"})\`.** This is a skill, not an agent. ` +
      `If you reached for the Agent tool, you're using the wrong primitive.\n\n` +
      body
    );
  }
  if (hint === "agent") {
    return (
      `> **Invoke via \`Agent({subagent_type: "aegis:${name}"})\`.** This is an agent, not a skill.\n\n` +
      body
    );
  }
  return body;
}

// ─────────────────────────────────────────────────────────────────────────────
// Template directive resolution (introduced v0.0.4; format-aware as of v0.0.8)
//
// Two forms, both resolved through manifest/template-index.json:
//   - `${TEMPLATE:<kind>}`          → the kind's `default` format body
//   - `${TEMPLATE:<kind>:<format>}` → the explicit <format> body for that kind
//
// The index maps each kind to `{ default, formats:{html?,markdown?,json?} }`;
// each formats entry is a repo-relative path to a real on-disk body. Existing
// bare tokens (${TEMPLATE:plans}, ${TEMPLATE:decisions}, …) stay backward-
// compatible: the index seeds those kinds with `default: markdown` →
// templates/markdown/<kind>/default.md, so they resolve to the same file as
// before. The resolver is no longer markdown-only (it resolves html/json too)
// and no longer Codex-only (per-host behavior below applies to every host).
//
// Per-host behavior (semantics unchanged from v0.0.4 — just driven by the
// index-resolved path/family instead of a hardcoded markdown path):
//   - Codex: bundled-path reference to the resolved body (8 KB skill cap means
//     bodies are never inlined). The markdown templates are shipped into the
//     Codex plugin tree by projectCodex(); html/json bodies referenced by a
//     Codex skill would need the same treatment if/when such a reference is
//     authored — today every Codex-reachable ${TEMPLATE} token is a markdown
//     kind, so the shipped markdown tree covers them.
//   - Transform host that ships templates/ at ${CLAUDE_PLUGIN_ROOT}: inline the
//     resolved body when under 2 KB, else emit a Read(...) instruction. HTML and
//     any large body always take the Read(...) path (never inlined). NOTE: Claude
//     reads canonical skills/ directly and OpenCode filesystem-discovers them, so
//     neither currently runs this branch — it activates only if/when those hosts
//     gain a skill-transform step.
//   - Cursor, Zed: no skill primitive; literal file-path reference (documented
//     gap in adapters/{cursor,zed}/projection.md). Not reached by this projector.
//
// Fails loudly (throws) on an unknown kind, an unknown format, or a format absent
// from the kind's `formats` — never emits a dangling token. assertNoTemplateTokens
// is the backstop that proves no ${TEMPLATE:…} survived projection.
// ─────────────────────────────────────────────────────────────────────────────

function bytesOf(body) {
  return Buffer.byteLength(body, "utf8");
}

const TEMPLATE_INLINE_THRESHOLD = 2048;
// `${TEMPLATE:<kind>}` or `${TEMPLATE:<kind>:<format>}`. <kind> kebab-case;
// optional `:<format>` where <format> ∈ {html, markdown, json}.
const TEMPLATE_DIRECTIVE = /\$\{TEMPLATE:([a-z0-9-]+)(?::([a-z]+))?\}/g;

// Load + cache the format index once per projector run. Hand-validated for the
// shape the resolver relies on (fail loud on malformed) — the full schema +
// cross-checks live in scripts/validate/template-index.mjs.
let _templateIndexCache = null;
function loadTemplateIndex() {
  if (_templateIndexCache) return _templateIndexCache;
  const path = join(REPO, "manifest", "template-index.json");
  if (!existsSync(path)) {
    throw new Error("missing manifest/template-index.json — required by the ${TEMPLATE} resolver.");
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new Error(`manifest/template-index.json invalid JSON: ${e.message}`);
  }
  if (!parsed.kinds || typeof parsed.kinds !== "object") {
    throw new Error("manifest/template-index.json: missing object property `kinds`.");
  }
  _templateIndexCache = parsed.kinds;
  return _templateIndexCache;
}

// Resolve a (kind, format?) pair to a repo-relative body path via the index.
// Throws on unknown kind / unknown format / format absent from the kind.
function resolveTemplatePath(kind, format) {
  const kinds = loadTemplateIndex();
  const entry = kinds[kind];
  if (!entry) {
    throw new Error(
      `unresolved \${TEMPLATE:${kind}} — kind '${kind}' is not registered in manifest/template-index.json.`,
    );
  }
  const fmt = format ?? entry.default;
  if (format && !["html", "markdown", "json"].includes(format)) {
    throw new Error(
      `unresolved \${TEMPLATE:${kind}:${format}} — unknown format '${format}' (expected html|markdown|json).`,
    );
  }
  const relPath = entry.formats?.[fmt];
  if (!relPath) {
    throw new Error(
      `unresolved \${TEMPLATE:${kind}${format ? ":" + format : ""}} — kind '${kind}' does not ship format '${fmt}' ` +
        `(available: ${Object.keys(entry.formats || {}).join(", ") || "none"}).`,
    );
  }
  const abs = join(REPO, relPath);
  if (!existsSync(abs)) {
    throw new Error(
      `unresolved \${TEMPLATE:${kind}${format ? ":" + format : ""}} — index path '${relPath}' does not exist on disk.`,
    );
  }
  return { relPath, abs, format: fmt };
}

function resolveTemplateDirectives(body, { host }) {
  return body.replace(TEMPLATE_DIRECTIVE, (_match, kind, format) => {
    const { relPath, abs, format: fmt } = resolveTemplatePath(kind, format);
    if (host === "codex") {
      // Body stays small (cap-safe); the template ships alongside in the plugin tree.
      return (
        "Follow the structure in the bundled template `" +
        relPath +
        "` (shipped with this plugin)."
      );
    }
    // HTML and JSON are never inlined — always a Read(...) pointer. HTML because
    // it is large; JSON because its body carries raw `__SLOT__` placeholder
    // strings that would splat unfillable into a skill body. Only markdown (prose
    // with `{{ slot.key }}` the agent fills) inlines when under the threshold.
    if (fmt !== "html" && fmt !== "json") {
      const content = readFileSync(abs, "utf8").trim();
      if (bytesOf(content) < TEMPLATE_INLINE_THRESHOLD) {
        return content;
      }
    }
    return (
      "Read the template at `${CLAUDE_PLUGIN_ROOT}/" +
      relPath +
      "` and follow its structure exactly."
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent mode mapping
// ─────────────────────────────────────────────────────────────────────────────

const AGENT_MODE = {
  // Default for all agents is `subagent`; explicit `primary` only for the
  // orchestrator. ultra-worker is dispatched FROM another agent or user prompt,
  // not selected as a session's primary persona.
  orchestrator: "primary",
};

function modeFor(name) {
  return AGENT_MODE[name] ?? "subagent";
}

// ─────────────────────────────────────────────────────────────────────────────
// Projections
// ─────────────────────────────────────────────────────────────────────────────

function projectAgents() {
  const src = join(REPO, "agents");
  const dst = join(REPO, ".opencode", "agents");

  if (existsSync(dst)) rmSync(dst, { recursive: true, force: true });
  mkdirSync(dst, { recursive: true });

  const files = readdirSync(src)
    .filter((f) => f.endsWith(".md") && f !== "AGENTS.md" && f !== "CLAUDE.md");

  let count = 0;
  for (const file of files) {
    const raw = readFileSync(join(src, file), "utf8");
    const { fm, body } = parseFrontmatter(raw);
    const name = basename(file, ".md");

    // OpenCode agent frontmatter: description (required), mode, plus optional model/etc.
    const outFm = {
      description: fm.description,
      mode: modeFor(name),
    };

    // Canonical bodies are host-neutral as of v0.0.10 Phase F (no Invoke-via
    // blockquote to strip). OpenCode gets the body verbatim.
    const out = `${emitFrontmatter(outFm)}\n\n${body.trimStart()}`;
    writeFileSync(join(dst, file), out, "utf8");
    count++;
  }
  return count;
}

function projectCommands() {
  const src = join(REPO, "commands");
  const dst = join(REPO, ".opencode", "commands");

  if (existsSync(dst)) rmSync(dst, { recursive: true, force: true });
  mkdirSync(dst, { recursive: true });

  const files = readdirSync(src)
    .filter((f) => f.endsWith(".md") && f !== "AGENTS.md" && f !== "CLAUDE.md");

  let count = 0;
  for (const file of files) {
    const raw = readFileSync(join(src, file), "utf8");
    const { fm, body } = parseFrontmatter(raw);

    // OpenCode command frontmatter: description (required), plus optional
    // agent/model/subtask. `argument-hint` is a Claude-only field (not a
    // documented OpenCode config.command field) — not promoted here.
    const outFm = {
      description: fm.description,
    };

    // Canonical bodies are host-neutral as of v0.0.10 Phase F — body verbatim.
    const out = `${emitFrontmatter(outFm)}\n\n${body.trimStart()}`;
    writeFileSync(join(dst, file), out, "utf8");
    count++;
  }
  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// Codex projection (v0.0.3)
//
// Codex's only first-class primitive is the Agent Skill. Aegis folds:
//   - canonical skills          → .codex/plugins/aegis/skills/aegis-<name>/SKILL.md
//   - canonical agents          → .codex/plugins/aegis/skills/aegis-<name>/SKILL.md (folded in)
//   - canonical commands        → .codex/plugins/aegis/skills/aegis-<name>/SKILL.md (thin dispatcher)
//   - canonical rules           → .codex-plugin/AGENTS.md (concatenated)
//
// Constraints (locked in the Codex skill-projection decisions record):
//   - aegis- prefix on every projected skill (collision avoidance across plugins
//     AND with Codex reserved names default/worker/explorer)
// Note: the per-body 8 KB cap was removed once it was found to be bogus. The real Codex
// budget is ~8,000 chars on the skills LIST (descriptions), not per-body. See
// .aegis/research/codex-modernization.research.md §1.
// ─────────────────────────────────────────────────────────────────────────────

const AEGIS_PREFIX = "aegis-";
const CODEX_NAME_PATTERN = /^aegis-[a-z0-9][a-z0-9-]*$/;
const CODEX_RESERVED_NAMES = new Set(["default", "worker", "explorer"]);

function prefixAegis(name) {
  return AEGIS_PREFIX + name;
}

// Shallow-copy every *.md file in src to dst (no recursion, no transformation).
// Used to project abilities/ and references/ siblings verbatim alongside Codex
// SKILL.md emissions.
function copyDirShallow(src, dst, pattern = /\.md$/) {
  if (!existsSync(src)) return 0;
  mkdirSync(dst, { recursive: true });
  let copied = 0;
  for (const entry of readdirSync(src)) {
    if (!pattern.test(entry)) continue;
    const srcFile = join(src, entry);
    let st;
    try {
      st = statSync(srcFile);
    } catch {
      continue;
    }
    if (!st.isFile()) continue;
    copyFileSync(srcFile, join(dst, entry));
    copied++;
  }
  return copied;
}

// Recursively copy a directory tree (files + subdirs). Used to ship the markdown
// templates into the Codex plugin tree so ${TEMPLATE} path references resolve there.
function copyDirRecursive(src, dst) {
  if (!existsSync(src)) return 0;
  mkdirSync(dst, { recursive: true });
  let copied = 0;
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const dstPath = join(dst, entry);
    const st = statSync(srcPath);
    if (st.isDirectory()) {
      copied += copyDirRecursive(srcPath, dstPath);
    } else if (st.isFile()) {
      copyFileSync(srcPath, dstPath);
      copied++;
    }
  }
  return copied;
}

// Atomic-ish replace: remove finalPath if present, then rename tmpPath to it.
// Stdlib has no true atomic dir swap; this is the best portable approximation.
function atomicReplace(tmpPath, finalPath) {
  if (existsSync(finalPath)) {
    rmSync(finalPath, { recursive: true, force: true, maxRetries: 3 });
  }
  renameSync(tmpPath, finalPath);
}

function extractIronLawsBlock() {
  const rootAgents = readFileSync(join(REPO, "AGENTS.md"), "utf8");
  const lines = rootAgents.split("\n");
  const startIdx = lines.findIndex((l) => l.trim() === "## Iron Laws");
  if (startIdx < 0) {
    throw new Error(
      "Root AGENTS.md is missing the ## Iron Laws section — Codex AGENTS.md projection requires it.",
    );
  }
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) {
      endIdx = i;
      break;
    }
  }
  return lines.slice(startIdx, endIdx).join("\n").trimEnd();
}

function projectCodexRules() {
  const src = join(REPO, "rules");
  const files = readdirSync(src)
    .filter((f) => f.endsWith(".md") && f !== "AGENTS.md" && f !== "CLAUDE.md")
    .sort();
  const ironLaws = extractIronLawsBlock();
  const out = ["# Aegis Codex Plugin — Rules", "", ironLaws, "", "# Rules", ""];
  for (const file of files) {
    const raw = readFileSync(join(src, file), "utf8");
    const { body } = parseFrontmatter(raw);
    const name = basename(file, ".md");
    out.push("## " + name);
    out.push("");
    out.push(body.trim());
    out.push("");
  }
  const dstDir = join(REPO, ".codex-plugin");
  mkdirSync(dstDir, { recursive: true });
  // Atomic emit: write to .tmp, then rename onto AGENTS.md.
  const finalPath = join(dstDir, "AGENTS.md");
  const tmpPath = finalPath + ".tmp";
  writeFileSync(tmpPath, out.join("\n") + "\n", "utf8");
  atomicReplace(tmpPath, finalPath);
  return files.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// Codex plugin manifest + MCP stub
//
// Emits the official plugin manifest at the plugin-root location:
//   .codex/plugins/aegis/.codex-plugin/plugin.json
// with component pointers (skills, mcpServers) + keywords (renamed from tags).
// Also emits the empty MCP stub at plugin-root .codex/plugins/aegis/.mcp.json.
//
// The repo-root .codex-plugin/plugin.json (old location) is deleted after the
// first run — it's no longer the correct location. .codex-plugin/AGENTS.md
// stays (rules surface for Codex at project root, out of scope for Phase B).
//
// `hooks` pointer: Codex's `plugin_hooks` feature is REMOVED (not
// merely disabled) as of codex-cli 0.144.6 — a plugin cannot ship hooks that
// fire, in any context. No canonical hooks/*.json intent binds `codex` in
// `platforms` today, so `hasCodexHooks` is always false in practice. The
// parameter (and the `./hooks/hooks.json` branch) stay so a future Codex
// release that un-removes plugin_hooks has a real re-enable path — but the
// default posture is explicit suppression: `hooks: {}`, the same pattern
// Superpowers uses (`.codex-plugin/plugin.json`) to stop Codex from
// auto-discovering a `hooks/` directory by convention. See
// adapters/codex/projection.md "Honest Gaps" for the full writeup.
// ─────────────────────────────────────────────────────────────────────────────

function projectCodexPluginManifest(hasCodexHooks) {
  const pluginRoot = join(REPO, ".codex/plugins/aegis");
  const manifestDir = join(pluginRoot, ".codex-plugin");
  const manifestPath = join(manifestDir, "plugin.json");
  const mcpPath = join(pluginRoot, ".mcp.json");

  // These constants are the code-owned manifest defaults. The old-repo-root
  // .codex-plugin/plugin.json read was a one-time migration helper; that file
  // is now deleted and the read is a no-op. The values below ARE the canonical
  // defaults — edit here to change what project.mjs emits.
  const CODEX_MANIFEST_DEFAULTS = {
    name: "aegis",
    description: "Plugin-first agentic AI development system. Skills, agents, commands, rules, and templates for software development tasks.",
    homepage: "https://github.com/hyprtuna/aegis",
    license: "MIT",
    author: { name: "Aegis Contributors" },
  };

  // Build the official plugin.json with component pointers.
  // keywords replaces tags. skills + mcpServers are mandatory pointers.
  // hooks is a real pointer only when at least one canonical intent binds
  // `codex`; otherwise it is the explicit-suppression `{}` form so
  // Codex never auto-discovers a stale/absent hooks/hooks.json by convention.
  const manifest = {
    name: CODEX_MANIFEST_DEFAULTS.name,
    version: PKG_VERSION,
    description: CODEX_MANIFEST_DEFAULTS.description,
    homepage: CODEX_MANIFEST_DEFAULTS.homepage,
    license: CODEX_MANIFEST_DEFAULTS.license,
    author: CODEX_MANIFEST_DEFAULTS.author,
    keywords: ["agentic", "skills", "agents", "anvil"],
    skills: "./skills/",
    hooks: hasCodexHooks ? "./hooks/hooks.json" : {},
    mcpServers: "./.mcp.json",
  };

  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  // Emit the empty MCP stub at plugin-root (D-06). Per MCP policy, ships none.
  writeFileSync(mcpPath, JSON.stringify({ mcpServers: {} }, null, 2) + "\n", "utf8");

  // Migrate: delete any lingering old repo-root .codex-plugin/plugin.json and
  // .codex-plugin/mcp.json (migration is complete; these are no-ops post-v0.2.0).
  const oldManifestPath = join(REPO, ".codex-plugin", "plugin.json");
  if (existsSync(oldManifestPath)) rmSync(oldManifestPath, { force: true });
  const oldMcpPath = join(REPO, ".codex-plugin", "mcp.json");
  if (existsSync(oldMcpPath)) rmSync(oldMcpPath, { force: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// Marketplace manifests — ONE PER HOST, no cross-host leak (v0.3.4).
//
// Codex → .agents/plugins/marketplace.json : OBJECT source form
//   { source: "local", path: "./.codex/plugins/aegis" } — required by
//   `codex plugin add`; the string "./" form errors "plugin was not found in
//   marketplace". This is Codex's canonical (and only) discovery path.
// Claude → .claude-plugin/marketplace.json : STRING source "./" (repo root) —
//   Claude REJECTS the object form (`plugins.0.source: Invalid input`). Written
//   by projectClaudeMarketplace() below.
// OpenCode → no marketplace file (installs via opencode.json edits; see
//   .opencode/INSTALL.md and adapters/opencode/projection.md — honest gap).
//
// Before v0.3.4 both files were written in the Codex object shape, which broke
// `claude plugin validate .` and left Aegis with no installable Claude
// marketplace.
// ─────────────────────────────────────────────────────────────────────────────

function projectCodexMarketplaces() {
  const marketplaceEntry = {
    name: "aegis",
    source: { source: "local", path: "./.codex/plugins/aegis" },
    description: "Plugin-first agentic AI development system.",
    version: PKG_VERSION,
    category: "development",
    keywords: ["agentic", "skills", "agents", "anvil"],
    policy: { installation: "AVAILABLE" },
  };

  const marketplaceDoc = {
    name: "aegis",
    owner: { name: "Aegis Contributors" },
    plugins: [marketplaceEntry],
  };

  // Codex canonical marketplace — the sole Codex discovery path.
  const agentsPluginsDir = join(REPO, ".agents", "plugins");
  mkdirSync(agentsPluginsDir, { recursive: true });
  writeFileSync(
    join(agentsPluginsDir, "marketplace.json"),
    JSON.stringify(marketplaceDoc, null, 2) + "\n",
    "utf8",
  );
}

// Claude marketplace (.claude-plugin/marketplace.json). Claude requires the
// plugin `source` to be a RELATIVE PATH STRING that does not escape the
// marketplace root; "./" points at the repo root, where .claude-plugin/plugin.json
// lives. The object {source,path} form and any "../" escape both fail
// `claude plugin validate`. No `policy` field — Claude warns on unknown keys.
function projectClaudeMarketplace() {
  const marketplaceDoc = {
    name: "aegis",
    description: "Aegis — plugin-first agentic AI dev system: skills, agents, commands, rules, and templates for software development.",
    owner: { name: "Aegis Contributors" },
    plugins: [
      {
        name: "aegis",
        source: "./",
        description: "Plugin-first agentic AI development system.",
        version: PKG_VERSION,
        category: "development",
        keywords: ["agentic", "skills", "agents", "anvil"],
      },
    ],
  };

  writeFileSync(
    join(REPO, ".claude-plugin", "marketplace.json"),
    JSON.stringify(marketplaceDoc, null, 2) + "\n",
    "utf8",
  );
}

// Filter to Codex-bound intents that have an x-codex.event. Shared by
// projectCodexPluginManifest's caller (to decide the `hooks` pointer shape)
// and projectCodexHooks (to decide what to bundle). This is
// always empty — no canonical hooks/*.json intent binds `codex` — because
// Codex's `plugin_hooks` feature is removed (codex-cli 0.144.6). The filter
// stays live (not hardcoded to []) so a future intent that legitimately binds
// `codex` again projects with zero code changes here.
function filterCodexHookIntents(intents) {
  return (intents ?? []).filter(
    (i) => Array.isArray(i.platforms) && i.platforms.includes("codex") &&
           i["x-codex"] && typeof i["x-codex"].event === "string",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Codex hooks projection (v0.2.1)
//
// Emits .codex/plugins/aegis/hooks/hooks.json in Codex matcher-group shape and
// bundles the referenced hook scripts (copied from .claude-plugin/hooks/ and
// version-stamped) into .codex/plugins/aegis/hooks/. A hook either ships (its
// intent projects here) or is deleted from hooks/ — there is no disabled/parked
// state, so any bundled script/config left over from a removed intent is
// cleaned up on every run. Idempotent.
//
// When no intent binds `codex` (the current, expected state — see
// filterCodexHookIntents above), this ships NOTHING — no hooks.json, no
// bundled scripts, not even an empty hooks/ directory. Shipping an empty
// hooks.json behind a suppressed `{}` manifest pointer would still leave a
// stale artifact on disk for a host that might auto-discover it by
// convention; removing the directory entirely is the honest-gap posture.
// ─────────────────────────────────────────────────────────────────────────────

function projectCodexHooks(intents) {
  const pluginHooksDir = join(REPO, ".codex/plugins/aegis/hooks");
  const codexIntents = filterCodexHookIntents(intents);

  if (codexIntents.length === 0) {
    if (existsSync(pluginHooksDir)) {
      rmSync(pluginHooksDir, { recursive: true, force: true });
    }
    return 0;
  }

  mkdirSync(pluginHooksDir, { recursive: true });

  // Build the Codex hooks.json: group by event into matcher-group shape.
  // Shape: { "hooks": { "<Event>": [ { "matcher": "…", "hooks": [ { "type": "command", "command": "…" } ] } ] } }
  // Intents without a matcher omit the field (Codex accepts hooks without a matcher — fires on any tool).
  const hooksObj = {};
  for (const intent of codexIntents) {
    const xc = intent["x-codex"];
    const event = xc.event;
    if (!hooksObj[event]) hooksObj[event] = [];
    const hookEntry = { type: "command", command: xc.command };
    const group = {};
    if (xc.matcher) group.matcher = xc.matcher;
    group.hooks = [hookEntry];
    hooksObj[event].push(group);
  }

  const hooksJson = { hooks: hooksObj };
  const hooksJsonPath = join(pluginHooksDir, "hooks.json");
  const hooksJsonContent = JSON.stringify(hooksJson, null, 2) + "\n";
  // Idempotent: only write if changed.
  const existingHooksJson = existsSync(hooksJsonPath) ? readFileSync(hooksJsonPath, "utf8") : null;
  if (existingHooksJson !== hooksJsonContent) {
    writeFileSync(hooksJsonPath, hooksJsonContent, "utf8");
  }

  // Bundle each referenced script: copy .claude-plugin/hooks/<name>.sh →
  // .codex/plugins/aegis/hooks/<name>.sh with version stamp. Idempotent via atomicWrite.
  const expectedScripts = new Set();
  for (const intent of codexIntents) {
    const xclause = intent["x-codex"];
    if (xclause.dispatch !== "command" || typeof xclause.command !== "string") continue;
    // Resolve the canonical script from the x-claude binding (same name, Claude path).
    const xc = intent["x-claude"];
    if (!xc || xc.dispatch !== "command" || typeof xc.command !== "string") continue;
    const srcPath = join(REPO, xc.command);
    if (!existsSync(srcPath)) continue;
    // Target filename is the basename of the x-codex command path.
    const targetName = basename(xclause.command);
    expectedScripts.add(targetName);
    const dstPath = join(pluginHooksDir, targetName);
    const srcContent = readFileSync(srcPath, "utf8");
    const token = hookCommentSyntax(targetName);
    const stamped = stampHookContent(srcContent, token, PKG_VERSION);
    const existingScript = existsSync(dstPath) ? readFileSync(dstPath, "utf8") : null;
    if (existingScript !== stamped) {
      atomicWrite(dstPath, stamped);
    }
    // Ensure the bundled script is executable. atomicWrite preserves the target's
    // existing mode on replace, but new files start at 0o644 — we always want +x.
    // Check before setting to avoid a no-op chmod on every run.
    let needsChmod = false;
    try {
      const mode = statSync(dstPath).mode;
      needsChmod = (mode & 0o111) === 0; // any execute bit missing
    } catch { needsChmod = true; }
    if (needsChmod) chmodSync(dstPath, 0o755);
  }

  // Clean up any bundled file left over from a hook intent that no longer
  // exists (or no longer bundles a config file) — e.g. a removed hook's script,
  // or the permissions.json config a since-removed hook once needed.
  // A hook either ships (its script is in expectedScripts) or is gone entirely.
  //
  // The keep test is membership in expectedScripts and NOTHING else. An extension
  // filter here would delete a file this same function bundled seconds earlier:
  // the bundler writes basename(x-codex.command) whatever its extension, and
  // hookCommentSyntax() deliberately supports .mjs/.js/.cjs/.ts, so a `.sh`-only
  // keep silently reaped every non-shell hook in the run that created it.
  // expectedScripts already encodes exactly what belongs here.
  for (const entry of readdirSync(pluginHooksDir).sort()) {
    if (entry === "hooks.json") continue;
    if (expectedScripts.has(entry)) continue;
    const target = join(pluginHooksDir, entry);
    // Never delete a tree — same rule as the Claude prune. The bundled tree is
    // flat (x-codex.command allows no `/`), so a directory is an authoring error.
    if (statSync(target).isDirectory()) {
      throw new Error(
        `.codex/plugins/aegis/hooks/${entry} is a directory — this tree is flat. ` +
          "Bundled Codex hooks are written to the basename of x-codex.command; " +
          "delete the directory by hand.",
      );
    }
    rmSync(target, { force: true }); // no `recursive` — a directory must throw, never vanish
    console.log(`  pruned orphan Codex hook file: .codex/plugins/aegis/hooks/${entry}`);
  }

  return codexIntents.length;
}

function projectCodex(hookIntents) {

  const skillsRoot = join(REPO, ".codex/plugins/aegis/skills");
  const skillsTmpRoot = skillsRoot + ".tmp";
  const codexAgentsFinal = join(REPO, ".codex-plugin", "AGENTS.md");
  const codexAgentsTmp = codexAgentsFinal + ".tmp";

  // Cleanup stale .tmp artifacts from any prior failed run before we start.
  if (existsSync(skillsTmpRoot)) rmSync(skillsTmpRoot, { recursive: true, force: true, maxRetries: 3 });
  if (existsSync(codexAgentsTmp)) rmSync(codexAgentsTmp, { force: true });

  // Atomic emit: build the entire tree in a sibling `.tmp` directory, then
  // rename it onto `skillsRoot` only after every phase succeeds. A mid-run
  // throw leaves `.tmp` on disk (one-time cleanup happens on the next run, see
  // above) but the live tree at `skillsRoot` stays untouched.
  mkdirSync(skillsTmpRoot, { recursive: true });

  function emitCodexSkill(finalName, description, body, canonicalDir) {
    // Collision avoidance: the aegis- prefix prevents collision with Codex
    // reserved names (default/worker/explorer) and with other plugins.
    // Defense-in-depth: validate the shape so a malformed canonical `name:`
    // field can't escape the target directory via path traversal.
    if (!CODEX_NAME_PATTERN.test(finalName)) {
      throw new Error(
        "invalid Codex skill name (must match /^aegis-[a-z0-9][a-z0-9-]*$/): " + finalName,
      );
    }
    // Reserved-name guard on the UNPREFIXED canonical name. The aegis- prefix
    // alone would let `default` slip through as `aegis-default` — explicit
    // hard-fail keeps Codex's reserved namespace inviolate.
    const unprefixed = finalName.startsWith(AEGIS_PREFIX)
      ? finalName.slice(AEGIS_PREFIX.length)
      : finalName;
    if (CODEX_RESERVED_NAMES.has(unprefixed)) {
      throw new Error(
        "canonical surface uses Codex reserved name: " + unprefixed +
          " (forbidden: default, worker, explorer)",
      );
    }
    const outFm = emitFrontmatter({ name: finalName, description });
    const out = outFm + "\n\n" + body.trimStart();
    const outDir = join(skillsTmpRoot, finalName);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "SKILL.md"), out, "utf8");
    // Project sibling abilities/ and references/ folders verbatim. Per Iron
    // Law 4, abilities are on-demand fragments — minimal/no frontmatter,
    // copied as-is so the relative links inside SKILL.md resolve on Codex.
    if (canonicalDir) {
      copyDirShallow(join(canonicalDir, "abilities"), join(outDir, "abilities"));
      copyDirShallow(join(canonicalDir, "references"), join(outDir, "references"));
    }
  }

  function projectCodexSkills() {
    const scopes = ["core", "languages", "workflows"];
    const emitted = new Map(); // finalName → originating canonical path
    let count = 0;
    for (const scope of scopes) {
      const scopeDir = join(REPO, "skills", scope);
      if (!existsSync(scopeDir)) continue;
      for (const entry of readdirSync(scopeDir)) {
        const skillDir = join(scopeDir, entry);
        let st;
        try {
          st = statSync(skillDir);
        } catch {
          continue;
        }
        if (!st.isDirectory()) continue;
        const skillFile = join(skillDir, "SKILL.md");
        if (!existsSync(skillFile)) continue;
        const raw = readFileSync(skillFile, "utf8");
        const { fm, body } = parseFrontmatter(raw);
        if (!fm.name) throw new Error("canonical skill missing `name` frontmatter: " + skillFile);
        const finalName = prefixAegis(fm.name);
        if (emitted.has(finalName)) {
          throw new Error(
            "canonical skill name collision across scopes: " + finalName +
              " (first emitted from " + emitted.get(finalName) +
              ", collided at " + skillFile + ")",
          );
        }
        const cleanBody = resolveTemplateDirectives(body, { host: "codex" });
        emitCodexSkill(finalName, fm.description || "", cleanBody, skillDir);
        emitted.set(finalName, skillFile);
        count++;
      }
    }
    return { count, takenNames: new Set(emitted.keys()) };
  }

  function projectCodexAgentsAsSkills(takenNames) {
    const src = join(REPO, "agents");
    let count = 0;
    const files = readdirSync(src).filter(
      (f) => f.endsWith(".md") && f !== "AGENTS.md" && f !== "CLAUDE.md",
    );
    for (const file of files) {
      const raw = readFileSync(join(src, file), "utf8");
      const { fm, body } = parseFrontmatter(raw);
      if (!fm.name) throw new Error("canonical agent missing `name` frontmatter: agents/" + file);
      const finalName = prefixAegis(fm.name);
      if (takenNames.has(finalName)) {
        throw new Error(
          "canonical agent/skill name collision: agent '" + file +
            "' projects to '" + finalName +
            "' which is already taken by a skill. Rename the agent in canonical authoring.",
        );
      }
      // Canonical body is host-neutral (Phase F) — no strip needed.
      const header = "> Invoked via Codex Skill discovery.\n\n";
      const composedBody = header + body.trimStart();
      // Agents are flat .md files — no sibling abilities/ or references/.
      emitCodexSkill(finalName, fm.description || "", composedBody, null);
      takenNames.add(finalName);
      count++;
    }
    return { count, takenNames };
  }

  function projectCodexCommandsAsDispatchers(takenNames) {
    const src = join(REPO, "commands");
    let count = 0;
    const files = readdirSync(src).filter(
      (f) => f.endsWith(".md") && f !== "AGENTS.md" && f !== "CLAUDE.md",
    );
    for (const file of files) {
      const raw = readFileSync(join(src, file), "utf8");
      const { fm, body } = parseFrontmatter(raw);
      if (!fm.name) throw new Error("canonical command missing `name` frontmatter: commands/" + file);
      const commandName = fm.name || basename(file, ".md");
      const siblingName = prefixAegis(commandName);
      const siblingExists = takenNames.has(siblingName);

      // Suffix until unique — a single `__command` may itself collide as the
      // command surface grows, so loop until clear.
      let finalName = prefixAegis(commandName);
      while (takenNames.has(finalName)) finalName = finalName + "__command";

      let dispatcherBody;
      if (siblingExists) {
        // Sibling skill/agent exists under the same base name — redirect
        // Codex users to it. Codex has no slash-command primitive, so the
        // canonical command's workflow lives in the sibling on this host.
        // Intentionally avoid printing the canonical `commands/<file>` path:
        // it would be a dead link on Codex and tempts users off-host.
        dispatcherBody = [
          "> Dispatcher skill (Codex projection of a canonical command).",
          "",
          "On Codex, invoke the sibling skill **" + siblingName + "** for the full workflow (Codex has no slash-command primitive — commands fold into their underlying skill on this host).",
          "",
        ].join("\n");
      } else {
        // No sibling — inline the canonical command body verbatim. Codex
        // users invoke this skill and get the prose directly. We intentionally
        // do not print the canonical `commands/<file>` path; it would be a dead
        // reference on the Codex host.
        const stripped = resolveTemplateDirectives(body, { host: "codex" });
        dispatcherBody = stripped.trimStart().trimEnd() + "\n";
      }
      emitCodexSkill(finalName, fm.description || "", dispatcherBody, null);
      takenNames.add(finalName);
      count++;
    }
    return count;
  }

  const { count: skills, takenNames: skillNames } = projectCodexSkills();
  const { count: agents, takenNames: afterAgents } = projectCodexAgentsAsSkills(skillNames);
  const commands = projectCodexCommandsAsDispatchers(afterAgents);

  // All skill/agent/command phases succeeded — atomically swap the temp tree
  // onto the live path.
  atomicReplace(skillsTmpRoot, skillsRoot);

  // Rules projection is independent; it writes its own .tmp → final swap
  // internally so it stays atomic even though it runs after the skill swap.
  const rules = projectCodexRules();

  // Ship the markdown, html, and json templates into the Codex plugin tree so
  // the bundled-path references emitted by resolveTemplateDirectives() resolve
  // on Codex. Also fixes the pre-existing latent gap where
  // :json bundled-pointers (design-system, plan-audit-report) referenced
  // templates/json/... that never shipped on Codex.
  const codexTemplatesRoot = join(REPO, ".codex/plugins/aegis/templates");
  if (existsSync(codexTemplatesRoot)) rmSync(codexTemplatesRoot, { recursive: true, force: true });
  let templates = 0;
  for (const variant of ["markdown", "html", "json"]) {
    templates += copyDirRecursive(
      join(REPO, "templates", variant),
      join(codexTemplatesRoot, variant),
    );
  }

  // Ship manifest/template-index.json into the Codex plugin tree so a runtime
  // index read (rules/user-choice-discipline.md step 5) can resolve there too.
  const codexManifestDir = join(REPO, ".codex/plugins/aegis/manifest");
  mkdirSync(codexManifestDir, { recursive: true });
  copyFileSync(
    join(REPO, "manifest", "template-index.json"),
    join(codexManifestDir, "template-index.json"),
  );

  // Emit the official plugin manifest + MCP stub at plugin-root.
  // Deletes the old repo-root .codex-plugin/plugin.json and .codex-plugin/mcp.json.
  // hooks pointer is real only when a canonical intent binds `codex`;
  // computed up front so the manifest and the hooks bundle agree.
  const codexHookIntents = filterCodexHookIntents(hookIntents ?? []);
  projectCodexPluginManifest(codexHookIntents.length > 0);

  // Emit .agents/plugins/marketplace.json (canonical) and correct
  // .claude-plugin/marketplace.json to use the object source form.
  projectCodexMarketplaces();

  // Project hook intents to .codex/plugins/aegis/hooks/hooks.json + bundle scripts
  // (v0.2.1). Must run after projectCodexPluginManifest (hooks pointer wired).
  const hooks = projectCodexHooks(hookIntents ?? []);

  return { skills, agents, commands, rules, templates, hooks };
}

// ─────────────────────────────────────────────────────────────────────────────
// Statusline projection (v0.0.4)
//
// For each canonical preset under statuslines/<name>/statusline.json, emit a tiny
// generated shim `adapters/claude/statuslines/<name>.mjs` that imports the shared
// bulletproof runtime and runs the preset, plus a `.settings.json.snippet` showing
// the statusLine block the user merges into ~/.claude/settings.json. Paths inside
// the shim resolve relative to the shim's own location (import.meta.url), so they
// hold wherever the plugin is installed. Claude Code is the only host with a real
// statusline projection; other hosts are honest gaps (see adapters/<host>/projection.md).
// ─────────────────────────────────────────────────────────────────────────────

function projectStatuslines() {
  const presetsRoot = join(REPO, "statuslines");
  const dst = join(REPO, "adapters", "claude", "statuslines");
  if (!existsSync(presetsRoot)) return 0;

  // Atomic emit: build the whole tree in a sibling `.tmp`, then swap it onto the
  // live path only after every file is written. A throw mid-loop (e.g. a malformed
  // descriptor) leaves the live statusline tree untouched rather than empty/partial.
  const dstTmp = dst + ".tmp";
  if (existsSync(dstTmp)) rmSync(dstTmp, { recursive: true, force: true, maxRetries: 3 });
  mkdirSync(dstTmp, { recursive: true });

  const presets = readdirSync(presetsRoot).filter((e) => {
    if (e.startsWith("_") || e === "AGENTS.md" || e === "CLAUDE.md") return false;
    return existsSync(join(presetsRoot, e, "statusline.json"));
  });

  let count = 0;
  for (const name of presets) {
    const desc = JSON.parse(readFileSync(join(presetsRoot, name, "statusline.json"), "utf8"));
    const theme = desc.theme || "mono";
    const shim =
      "#!/usr/bin/env node\n" +
      "// GENERATED by scripts/project.mjs — do not edit. Source: statuslines/" + name + "/statusline.json\n" +
      'import { run } from "../../../statuslines/_shared/runtime.mjs";\n' +
      'import { fileURLToPath } from "node:url";\n' +
      'const descriptor = fileURLToPath(new URL("../../../statuslines/' + name + '/statusline.json", import.meta.url));\n' +
      "run(descriptor, " + JSON.stringify(theme) + ");\n";
    writeFileSync(join(dstTmp, name + ".mjs"), shim, "utf8");

    const snippet = JSON.stringify(
      {
        statusLine: {
          type: "command",
          command: 'node "${CLAUDE_PLUGIN_ROOT}/adapters/claude/statuslines/' + name + '.mjs"',
          padding: 0,
        },
      },
      null,
      2,
    ) + "\n";
    writeFileSync(join(dstTmp, name + ".settings.json.snippet"), snippet, "utf8");
    count++;
  }

  // Subagent statusline variant (shared, preset-independent).
  if (existsSync(join(presetsRoot, "_shared", "subagent-runtime.mjs"))) {
    const subShim =
      "#!/usr/bin/env node\n" +
      "// GENERATED by scripts/project.mjs — do not edit. Source: statuslines/_shared/subagent-runtime.mjs\n" +
      'import { run } from "../../../statuslines/_shared/subagent-runtime.mjs";\n' +
      "run();\n";
    writeFileSync(join(dstTmp, "_subagent.mjs"), subShim, "utf8");
    const subSnippet = JSON.stringify(
      {
        subagentStatusLine: {
          type: "command",
          command: 'node "${CLAUDE_PLUGIN_ROOT}/adapters/claude/statuslines/_subagent.mjs"',
          padding: 0,
        },
      },
      null,
      2,
    ) + "\n";
    writeFileSync(join(dstTmp, "_subagent.settings.json.snippet"), subSnippet, "utf8");
  }

  atomicReplace(dstTmp, dst);
  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// Claude generated-tree projection (v0.0.5)
//
// Generates a Claude-native surface tree under adapters/claude/{skills,agents}/
// from canonical skills/ and agents/, then regenerates the GENERATED blocks of
// .claude-plugin/plugin.json (skills, agents, userConfig, dependencies) while
// deep-preserving every hand-maintained key. The tree is committed (DH2) so a
// git-spec install finds real files — there is no build step on the user's box.
//
// Per-surface transform pipeline (DH6 build order):
//   1. resolveTemplateDirectives(body, { host: "claude" })  ← inline(<2KB)/Read branch
//   2. provider-tagged prose fork: keep <claude>…</claude> inner text, delete
//      <opencode>…</opencode> and any other host's blocks
//   3. injectInvocationBlockquote(body, x-claude.primitiveHint, name) — re-inject
//      the Claude-only Invoke-via primitive-disambiguation blockquote (Phase F);
//      canonical bodies are host-neutral, only Claude rebuilds + prepends it.
//   4. frontmatter: drop canonical-only keys, flatten x-claude.*, resolve model
//      alias, inject tools/disallowedTools (agents) from manifest/permissions.json
//   5. copy abilities/ (+ references/ + rules/ if present) siblings verbatim
//   6. atomic emit to *.tmp then atomicReplace onto the live path
// ─────────────────────────────────────────────────────────────────────────────

const MODELS = JSON.parse(readFileSync(join(REPO, "manifest", "models.json"), "utf8"));
const PERMISSIONS = JSON.parse(readFileSync(join(REPO, "manifest", "permissions.json"), "utf8"));

// Resolve a canonical `model:` alias to its Claude-native ID via manifest/models.json.
// `inherit`/absent → null (omit `model:`). Unknown alias → hard-fail (DH-style loud failure).
function resolveClaudeModel(alias) {
  if (!alias) return null;
  if (alias === "inherit") return null;
  // Accept either a canonical alias key (opus/sonnet/...) or an aliasOf synonym.
  const canonical = MODELS.aliases[alias] ? alias : MODELS.aliasOf?.[alias];
  if (!canonical || !MODELS.aliases[canonical]) {
    throw new Error(
      `unknown model alias '${alias}' — not found in manifest/models.json (aliases/aliasOf). ` +
        `Add it to the manifest or fix the canonical frontmatter.`,
    );
  }
  const claudeId = MODELS.aliases[canonical].claude;
  if (claudeId === "inherit") return null;
  return claudeId;
}

// Fork provider-tagged prose: keep the inner text of <claude>…</claude>
// blocks (tags stripped), delete <opencode>…</opencode> and any other host's
// tagged blocks entirely. Multiline-aware. Soft cap: >3 blocks → console.warn.
const PROVIDER_TAGS = ["claude", "opencode", "codex", "cursor", "zed"];
function forkProviderProse(body, surfaceLabel) {
  let blockCount = 0;
  let out = body;
  for (const tag of PROVIDER_TAGS) {
    const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g");
    out = out.replace(re, (_m, inner) => {
      blockCount++;
      return tag === "claude" ? inner : "";
    });
  }
  if (blockCount > 3) {
    console.warn(
      `Claude projection: ${surfaceLabel} has ${blockCount} provider-tag blocks (soft cap 3) — consider trimming host-forked prose.`,
    );
  }
  return out;
}

// Build the Claude-native body from a canonical body. Order matters (DH6).
// v0.0.10 Phase F: re-inject the Invoke-via primitive-disambiguation blockquote
// from `x-claude.primitiveHint` (skill/agent) + the surface `name`, PREPENDED
// after template/prose forking so it always opens the Claude body. `hint`/`name`
// come from canonical frontmatter; absent hint → no blockquote (host-neutral).
function claudeBody(body, surfaceLabel, hint, name) {
  let b = resolveTemplateDirectives(body, { host: "claude" });
  b = forkProviderProse(b, surfaceLabel);
  b = b.trimStart();
  return injectInvocationBlockquote(b, hint, name);
}

// Build Claude-native skill frontmatter from canonical fm. Emits only
// name/description/model(resolved)/flattened x-claude.* . Drops kind/visibility/
// platforms/source and the whole x-claude/x-opencode blocks (DH3).
function claudeSkillFrontmatter(fm) {
  const out = {};
  if (fm.name) out.name = fm.name;
  if (fm.description) out.description = fm.description;
  const model = resolveClaudeModel(fm.model);
  if (model) out.model = model;
  flattenXClaude(fm, out);
  return out;
}

// Build Claude-native COMMAND frontmatter: description + argument-hint
// (promoted from x-claude.argument-hint by flattenXClaude) + any allowed-tools.
// A command's invocation name comes from its FILENAME, so `name` is intentionally
// omitted (matches the working claude-hud reference). Drops kind/visibility/
// platforms/source + the whole x-claude/x-opencode blocks.
function claudeCommandFrontmatter(fm) {
  const out = {};
  if (fm.description) out.description = fm.description;
  flattenXClaude(fm, out);
  return out;
}

// Flatten the canonical `x-claude` block into Claude-native top-level keys:
//   x-claude.paths            → paths (array)
//   x-claude.agent            → agent
//   x-claude.disallowed-tools → disallowedTools
//   x-claude.argument-hint    → argument-hint
//   x-claude.skills           → skills (subagent preload, Claude-only — NOT emitted by OpenCode/Codex)
// `x-claude.primitiveHint` is dropped here (consumed by claudeBody, never emitted).
// NOTE: x-claude.model / x-claude.fallbackModel are FORBIDDEN on canonical agent/skill
// frontmatter. Per-agent model is set SOLELY via manifest/permissions.json (D3 single-source)
// and projected by the permissions-injection block below (~line 1157). Attempting to add
// x-claude.model will hard-fail at projection time to prevent a silent conflicting second source.
// Any other x-claude.<k> is passed through under its own key (forward-compatible).
// Valid scopes for x-claude.memory (cc-docs sub-agents.md §453-490).
const MEMORY_VALID_SCOPES = new Set(["user", "project", "local"]);

function flattenXClaude(fm, out) {
  const xc = fm["x-claude"];
  if (!xc || typeof xc !== "object") return;
  for (const [k, v] of Object.entries(xc)) {
    // primitiveHint is consumed-not-emitted: claudeBody() reads it to rebuild the
    // Invoke-via blockquote (Phase F); it is an internal authoring hint, NOT a
    // Claude frontmatter field, so it must never leak into generated frontmatter.
    if (k === "primitiveHint") continue;
    if (k === "disallowed-tools") { out.disallowedTools = v; continue; }
    // model / fallbackModel: HARD-FAIL — not supported on canonical frontmatter.
    // Per-agent model is the sole responsibility of manifest/permissions.json (D3
    // single-source); declaring x-claude.model would create a conflicting second
    // source (canonical says X, permissions ships Y → misleading dead field).
    // Remove x-claude.model / x-claude.fallbackModel from the canonical file.
    if (k === "model" || k === "fallbackModel") {
      throw new Error(
        `x-claude.model / x-claude.fallbackModel is not supported on canonical frontmatter ` +
          `(D3 single-source violation). Per-agent model is set in manifest/permissions.json ` +
          `and projected by the permissions-injection block. ` +
          `Remove x-claude.${k} from the canonical file.`,
      );
    }
    // memory: validate scope ∈ {user, project, local}; emit as-is (Claude-only).
    if (k === "memory") {
      if (!MEMORY_VALID_SCOPES.has(v)) {
        throw new Error(
          `x-claude.memory scope '${v}' is invalid. ` +
            `Must be one of: user, project, local.`,
        );
      }
    }
    // effort / isolation / maxTurns / background — native plugin-subagent execution
    // profile (cc-docs sub-agents.md, plugins-reference.md). Claude-only; parseFrontmatter
    // stores these as STRINGS (no coercion), so validation+coercion is delegated to the
    // shared, testable module (a strict-review HIGH fix — the coerced value,
    // not the raw string, is what gets emitted).
    if (SUBAGENT_PRIMITIVE_KEYS.has(k)) {
      out[k] = validateSubagentPrimitive(k, v);
      continue;
    }
    out[k] = v;
  }
}

function projectClaude(hookIntents) {
  const claudeRoot = join(REPO, "adapters", "claude");
  const skillsFinal = join(claudeRoot, "skills");
  const agentsFinal = join(claudeRoot, "agents");
  const commandsFinal = join(claudeRoot, "commands");
  const skillsTmp = skillsFinal + ".tmp";
  const agentsTmp = agentsFinal + ".tmp";
  const commandsTmp = commandsFinal + ".tmp";

  // Cleanup stale .tmp artifacts from any prior failed run.
  if (existsSync(skillsTmp)) rmSync(skillsTmp, { recursive: true, force: true, maxRetries: 3 });
  if (existsSync(agentsTmp)) rmSync(agentsTmp, { recursive: true, force: true, maxRetries: 3 });
  if (existsSync(commandsTmp)) rmSync(commandsTmp, { recursive: true, force: true, maxRetries: 3 });
  mkdirSync(skillsTmp, { recursive: true });
  mkdirSync(agentsTmp, { recursive: true });
  mkdirSync(commandsTmp, { recursive: true });

  const emittedSkills = []; // { scope, name } in deterministic order
  const emittedAgents = []; // name
  const emittedCommands = []; // name

  // ── Skills ────────────────────────────────────────────────────────────────
  const scopes = ["core", "languages", "workflows"];
  for (const scope of scopes) {
    const scopeDir = join(REPO, "skills", scope);
    if (!existsSync(scopeDir)) continue;
    const entries = readdirSync(scopeDir).sort();
    for (const entry of entries) {
      const skillDir = join(scopeDir, entry);
      let st;
      try {
        st = statSync(skillDir);
      } catch {
        continue;
      }
      if (!st.isDirectory()) continue;
      const skillFile = join(skillDir, "SKILL.md");
      if (!existsSync(skillFile)) continue;

      const raw = readFileSync(skillFile, "utf8");
      const { fm, body } = parseFrontmatter(raw);
      if (!fm.name) throw new Error("canonical skill missing `name` frontmatter: " + skillFile);

      const outBody = claudeBody(body, `skill ${scope}/${entry}`, fm["x-claude"]?.primitiveHint, fm.name);
      const outFm = claudeSkillFrontmatter(fm);
      const out = emitFrontmatter(outFm) + "\n\n" + outBody;

      const outDir = join(skillsTmp, scope, fm.name);
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, "SKILL.md"), out, "utf8");

      // Copy sibling on-demand fragments verbatim so relative links in SKILL.md
      // resolve in the generated tree. abilities/ + references/ per DH6; rules/
      // is an existing sibling that python-developer's SKILL.md links to
      // relatively, so it rides along under the same "copy siblings verbatim" rule.
      for (const sib of ["abilities", "references", "rules"]) {
        copyDirShallow(join(skillDir, sib), join(outDir, sib));
      }

      emittedSkills.push({ scope, name: fm.name });
    }
  }

  // ── Agents ──────────────────────────────────────────────────────────────--
  // Build the set of canonical skill names from emittedSkills (A4: x-claude.skills
  // must name real canonical skills — typos caught at projection time, not silently).
  const canonicalSkillNames = new Set(emittedSkills.map((s) => s.name));

  const agentsSrc = join(REPO, "agents");
  const agentFiles = readdirSync(agentsSrc)
    .filter((f) => f.endsWith(".md") && f !== "AGENTS.md" && f !== "CLAUDE.md")
    .sort();
  for (const file of agentFiles) {
    const raw = readFileSync(join(agentsSrc, file), "utf8");
    const { fm, body } = parseFrontmatter(raw);
    const name = fm.name || basename(file, ".md");

    // A4: validate x-claude.skills — every listed skill name must resolve to a real
    // canonical skill (skills/{core,languages,workflows}/<name>/SKILL.md). Fail-fast
    // on an unknown name so typos are caught at projection, not silently dropped.
    const xcSkills = fm["x-claude"]?.skills;
    if (Array.isArray(xcSkills)) {
      for (const skillName of xcSkills) {
        if (!canonicalSkillNames.has(skillName)) {
          throw new Error(
            `agents/${file}: x-claude.skills references '${skillName}', which is not a ` +
              `canonical skill (no skills/{core,languages,workflows}/${skillName}/SKILL.md). ` +
              `Fix the skill name or create the missing skill.`,
          );
        }
      }
    }

    const outBody = claudeBody(body, `agent ${name}`, fm["x-claude"]?.primitiveHint, name);
    const outFm = claudeSkillFrontmatter(fm);

    // Inject tools/model/disallowedTools from manifest/permissions.json.
    // permissions is the SOLE source for agent tools/model/disallow — never
    // canonical frontmatter (single-source of truth). Agents must never carry
    // hooks/mcpServers/permissionMode (plugins-reference.md:70).
    const perm = PERMISSIONS.agents?.[name]?.claude;
    if (perm?.tools) outFm.tools = perm.tools;
    // model: the manifest carries a canonical alias (opus/sonnet/haiku); resolve it
    // to the Claude-native ID via manifest/models.json, exactly like skills. Manifest
    // wins over any canonical fm.model so the agent set has one source of truth.
    if (perm?.model) {
      const claudeModel = resolveClaudeModel(perm.model);
      if (claudeModel) outFm.model = claudeModel;
      else delete outFm.model;
    }
    // Per-agent disallowedTools carries ONLY bare tool-name denials (the field
    // filters the tool pool, not path/arg specifiers — sub-agents.md:269,335).
    // The cross-cutting secret/destructive-Bash deny (plugin.deny[]) is NOT
    // expressible here and has no runtime enforcement on Claude — advisory only.
    if (perm?.disallowedTools) outFm.disallowedTools = perm.disallowedTools;

    // Memory guard (D-01 footgun prevention): native `memory` auto-enables
    // Read/Write/Edit — an agent that is hard-locked disallowedTools:[Write,Edit]
    // cannot persist memory. Fail-fast at projection rather than silently
    // shipping a broken configuration (cc-docs sub-agents.md §453-490).
    if (fm["x-claude"]?.memory) {
      const disallowed = perm?.disallowedTools ?? [];
      const blocked = disallowed.filter((t) => t === "Write" || t === "Edit");
      if (blocked.length > 0) {
        throw new Error(
          `agents/${file}: x-claude.memory requires Write/Edit access, but ` +
            `manifest/permissions.json disallowedTools for '${name}' includes ` +
            `[${blocked.join(", ")}]. Either remove the memory declaration or ` +
            `remove the Write/Edit disallow from manifest/permissions.json.`,
        );
      }
    }

    // Isolation guard: `isolation: worktree` is pointless for a read-only agent — a worktree
    // with no write capability can never be used. Fail-fast (parallels the memory guard).
    if (fm["x-claude"]?.isolation === "worktree") {
      assertIsolationWritable(name, perm?.tools);
    }

    const out = emitFrontmatter(outFm) + "\n\n" + outBody;
    writeFileSync(join(agentsTmp, basename(file)), out, "utf8");
    emittedAgents.push(name);
  }

  // ── Commands ──────────────────────────────────────────────────────────────
  // Project canonical commands/<name>.md → adapters/claude/commands/<name>.md with
  // Claude-native frontmatter. Without a projected tree + a plugin.json
  // `commands` key, Claude default-scans the raw canonical files, whose non-native
  // frontmatter (kind/x-claude/…) leaves them listed in the plugin panel but NOT
  // invokable (/aegis:<cmd> → "Unknown command"). Claude-only surface.
  const commandsSrc = join(REPO, "commands");
  const commandFiles = readdirSync(commandsSrc)
    .filter((f) => f.endsWith(".md") && f !== "AGENTS.md" && f !== "CLAUDE.md")
    .sort();
  for (const file of commandFiles) {
    const raw = readFileSync(join(commandsSrc, file), "utf8");
    const { fm, body } = parseFrontmatter(raw);
    const name = fm.name || basename(file, ".md");
    if (Array.isArray(fm.platforms) && !fm.platforms.includes("claude")) continue;

    const outBody = claudeBody(body, `command ${name}`, undefined, name);
    const outFm = claudeCommandFrontmatter(fm);
    const out = emitFrontmatter(outFm) + "\n\n" + outBody;
    writeFileSync(join(commandsTmp, `${name}.md`), out, "utf8");
    emittedCommands.push(name);
  }

  // ── Assert zero unresolved template tokens across the generated tree ───────-
  assertNoTemplateTokens(skillsTmp);
  assertNoTemplateTokens(agentsTmp);
  assertNoTemplateTokens(commandsTmp);

  // ── Atomic swap (skills + agents + commands); statuslines/ untouched ───────-
  atomicReplace(skillsTmp, skillsFinal);
  atomicReplace(agentsTmp, agentsFinal);
  atomicReplace(commandsTmp, commandsFinal);

  // ── Regenerate the GENERATED blocks of plugin.json ─────────────────────────-
  regeneratePluginJson(emittedSkills, emittedAgents, emittedCommands, hookIntents);

  return {
    skills: emittedSkills.length,
    agents: emittedAgents.length,
    commands: emittedCommands.length,
  };
}

// Walk a tree and throw if any file still contains a ${TEMPLATE:...} token.
function assertNoTemplateTokens(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) {
      assertNoTemplateTokens(p);
    } else if (st.isFile()) {
      const content = readFileSync(p, "utf8");
      if (/\$\{TEMPLATE\b/.test(content)) {
        throw new Error("unresolved \${TEMPLATE...} token remains in generated file: " + p);
      }
    }
  }
}

// Regenerate ONLY the generated blocks of .claude-plugin/plugin.json
// (skills, agents, userConfig, dependencies); deep-preserve every other key
// in original order. Writes 2-space indent + trailing newline.
function regeneratePluginJson(emittedSkills, emittedAgents, emittedCommands, hookIntents) {
  const pluginPath = join(REPO, ".claude-plugin", "plugin.json");
  const existing = JSON.parse(readFileSync(pluginPath, "utf8"));

  // skills: the distinct BUCKET ROOTS (./adapters/claude/skills/<scope>/), in
  // emission order (core, languages, workflows). Claude scans each `skills` array
  // entry ONE LEVEL DEEP for <name>/SKILL.md and ADDS them to the default `skills/`
  // scan (plugins-reference #path-behavior-rules). Listing the individual 82 skill
  // dirs made Claude look for `<skill>/<name>/SKILL.md` (one level too deep) so
  // ZERO registered. Bucket roots resolve to <name>/SKILL.md at depth 1,
  // so all skills load. Order-preserving dedup — new buckets flow through
  // automatically, no hardcoded list.
  const skills = [...new Set(emittedSkills.map((s) => s.scope))].map(
    (scope) => `./adapters/claude/skills/${scope}/`,
  );

  // agents: one FILE entry per generated agent. Claude's plugin-manifest
  // validation requires `agents` to be an array of .md file paths — a directory
  // entry (string or array, with or without trailing slash) fails install with
  // "agents: Invalid input" (verified empirically against `claude plugin
  // validate`, v0.0.14). Declaring `agents` still REPLACES the default root
  // agents/ scan, so the generated tree remains the only discovered agent
  // surface. Sorted for byte-stable output.
  const agents = [...emittedAgents]
    .sort()
    .map((name) => `./adapters/claude/agents/${name}.md`);

  // commands: one FILE entry per generated command, mirroring the
  // `agents` array form. Declaring `commands` REPLACES the default root commands/
  // scan, so the generated Claude-native tree (flattened frontmatter) is the only
  // discovered command surface — the raw canonical commands/ (non-native
  // frontmatter) is no longer scanned, which is what made /aegis:<cmd> fail.
  const commands = [...emittedCommands]
    .sort()
    .map((name) => `./adapters/claude/commands/${name}.md`);

  // hooks: generated from canonical hooks/*.json. Replaces the
  // previously hand-maintained block. A hook either ships (appears here) or is
  // deleted from hooks/ — there is no disabled/parked state.
  const hooks = generateClaudeHooksBlock(hookIntents ?? []);

  // userConfig. Schema per plugins-reference.md:550 requires
  // type/title/description; default is optional. Keep it minimal.
  const userConfig = {
    preferredLanguageOverlay: {
      type: "string",
      title: "Preferred language overlay",
      description: "Default language overlay skill to bias toward (e.g. python-developer). Empty for none.",
      default: "",
    },
    telemetryOptIn: {
      type: "boolean",
      title: "Telemetry opt-in",
      description: "Allow Aegis to collect anonymous usage telemetry.",
      default: false,
    },
  };

  // dependencies (E1): optional manifest/dependencies.json drives it; absent → [].
  const depsPath = join(REPO, "manifest", "dependencies.json");
  let dependencies = [];
  if (existsSync(depsPath)) {
    const parsed = JSON.parse(readFileSync(depsPath, "utf8"));
    if (!Array.isArray(parsed)) {
      throw new Error("manifest/dependencies.json must be a JSON array of plugin dependencies");
    }
    dependencies = parsed;
  }

  // Rebuild preserving original key order; overwrite the four generated keys in
  // place, and append any that weren't already present (agents/userConfig/
  // dependencies are new in v0.0.5).
  const generated = { skills, commands, hooks, agents, userConfig, dependencies };
  const out = {};
  for (const [k, v] of Object.entries(existing)) {
    out[k] = k in generated ? generated[k] : v;
  }
  // Append generated keys not already present, in a stable order next to skills.
  for (const k of ["commands", "hooks", "agents", "userConfig", "dependencies"]) {
    if (!(k in out)) out[k] = generated[k];
  }

  writeFileSync(pluginPath, JSON.stringify(out, null, 2) + "\n", "utf8");
}

// ─────────────────────────────────────────────────────────────────────────────
// Portable hook intents (v0.0.7)
//
// Canonical hook bindings live in flat hooks/<name>.json (the machine binding;
// the sibling hooks/<name>.md is the human intent doc). loadHookIntents() globs
// them, hand-validates shape (fail loud), and returns a deterministically sorted
// array. generateClaudeHooksBlock() builds the .claude-plugin/plugin.json `hooks`
// object from the claude-platform intents.
// injectOpencodeCompactionBridge() rewrites the guarded AEGIS:HOOKS-GEN region in
// .opencode/plugins/aegis.js, emitting aegisHookHandlers() — the flat dotted-key
// object OpenCode resolves plugin handlers from.
// ─────────────────────────────────────────────────────────────────────────────

// Glob hooks/*.json (non-recursive), JSON.parse, hand-validate the minimal
// shape the projector relies on (fail loud on malformed), return sorted by name.
function loadHookIntents() {
  const hooksDir = join(REPO, "hooks");
  if (!existsSync(hooksDir)) return [];
  const files = readdirSync(hooksDir).filter((f) => f.endsWith(".json")).sort();
  const intents = [];
  for (const file of files) {
    const path = join(hooksDir, file);
    let intent;
    try {
      intent = JSON.parse(readFileSync(path, "utf8"));
    } catch (e) {
      throw new Error(`malformed hook intent JSON: hooks/${file} (${e.message})`);
    }
    if (intent.kind !== "hook") {
      throw new Error(`hooks/${file}: kind must be "hook" (got ${JSON.stringify(intent.kind)})`);
    }
    if (typeof intent.name !== "string" || !intent.name) {
      throw new Error(`hooks/${file}: missing string "name"`);
    }
    // Filename base, minus the cosmetic ".prompt"/".agent" infix: a file
    // named verify-no-secrets-touched.prompt.json declares name
    // "verify-no-secrets-touched". The intent field is the authoritative
    // discriminator; the infix is presentational only.
    const fileBase = file.replace(/\.json$/, "").replace(/\.(prompt|agent)$/, "");
    if (intent.name !== fileBase) {
      throw new Error(`hooks/${file}: name "${intent.name}" must match filename base "${fileBase}"`);
    }
    if (!Array.isArray(intent.platforms) || intent.platforms.length === 0) {
      throw new Error(`hooks/${file}: "platforms" must be a non-empty array`);
    }
    if (intent.platforms.includes("claude")) {
      const xc = intent["x-claude"];
      if (!xc || typeof xc !== "object") {
        throw new Error(`hooks/${file}: platforms includes "claude" but x-claude binding is missing`);
      }
      if (!xc.event || !xc.dispatch) {
        throw new Error(`hooks/${file}: x-claude requires "event" and "dispatch"`);
      }
      if (xc.dispatch === "command" && (typeof xc.command !== "string" || !xc.command)) {
        throw new Error(`hooks/${file}: x-claude.dispatch "command" requires "command"`);
      }
      if ((xc.dispatch === "prompt" || xc.dispatch === "agent") && (typeof xc.prompt !== "string" || !xc.prompt)) {
        throw new Error(`hooks/${file}: x-claude.dispatch "${xc.dispatch}" requires "prompt"`);
      }
    }
    if (intent.platforms.includes("codex")) {
      const xcodex = intent["x-codex"];
      if (!xcodex || typeof xcodex !== "object") {
        throw new Error(`hooks/${file}: platforms includes "codex" but x-codex binding is missing`);
      }
      if (!xcodex.event || !xcodex.dispatch) {
        throw new Error(`hooks/${file}: x-codex requires "event" and "dispatch"`);
      }
      if (xcodex.dispatch === "command" && (typeof xcodex.command !== "string" || !xcodex.command)) {
        throw new Error(`hooks/${file}: x-codex.dispatch "command" requires "command"`);
      }
    }
    intents.push(intent);
  }
  intents.sort((a, b) => a.name.localeCompare(b.name));
  return intents;
}

// The Claude hooks-block generator (generateClaudeHooksBlock) now lives in the
// shared lib scripts/lib/hook-projection.mjs (imported at the top of this file)
// and is imported by the HOOK_INTENT validator too — single source of truth, no
// mirror.

// Derive the set of Claude command-hook script paths (absolute) from intents, so
// every dispatch:"command" hook auto-stamps without a hardcoded list.
function hookFilesFromIntents(intents) {
  const paths = [];
  for (const intent of intents) {
    const xc = intent["x-claude"];
    if (xc && xc.dispatch === "command" && typeof xc.command === "string") {
      paths.push(join(REPO, xc.command));
    }
  }
  return paths;
}

// Idempotently rewrite ONLY the guarded AEGIS:HOOKS-GEN region in aegis.js text.
// The region declares aegisHookHandlers() — the object OpenCode resolves handlers
// from. Two projector runs must produce identical bytes. Fails loud if the markers
// are absent or an intent names a handler the plugin does not define.
const OPENCODE_HOOKS_GEN_START = "// >>> AEGIS:HOOKS-GEN (generated by scripts/project.mjs — do not edit) >>>";
const OPENCODE_HOOKS_GEN_END = "// <<< AEGIS:HOOKS-GEN <<<";

// Canonical x-opencode.handler → the hand-written expression in aegis.js it binds
// to. Unknown handler names are a hard error: a binding that names a function the
// plugin does not define would emit a ReferenceError at plugin load, and a silently
// skipped binding would reproduce the exact dead-hook class this map exists to
// prevent. Handler bodies stay hand-written; only the KEY→handler wiring is
// generated, because the key strings are what must never drift from canonical.
const OPENCODE_HANDLER_EXPR = {
  bootstrap: "aegisBootstrapTransform(ctx)",
  compaction: "aegisCompaction",
};

function generateOpencodeHandlerMap(intents) {
  const lines = [];
  const seen = new Set();
  for (const intent of intents) {
    if (!Array.isArray(intent.platforms) || !intent.platforms.includes("opencode")) continue;
    const xo = intent["x-opencode"];
    if (!xo || typeof xo !== "object") {
      throw new Error(`hooks/${intent.name}.json: platforms includes "opencode" but x-opencode binding is missing`);
    }
    if (typeof xo.event !== "string" || !xo.event) {
      throw new Error(`hooks/${intent.name}.json: x-opencode requires a non-empty "event" (the literal OpenCode hook key)`);
    }
    if (seen.has(xo.event)) {
      throw new Error(
        `hooks/${intent.name}.json: x-opencode.event "${xo.event}" is already bound by another intent — ` +
          "duplicate keys in the generated object literal silently overwrite each other",
      );
    }
    const expr = OPENCODE_HANDLER_EXPR[xo.handler];
    if (!expr) {
      throw new Error(
        `hooks/${intent.name}.json: unknown x-opencode.handler "${xo.handler}" ` +
          `(known: ${Object.keys(OPENCODE_HANDLER_EXPR).join(", ")})`,
      );
    }
    seen.add(xo.event);
    lines.push(`    ${JSON.stringify(xo.event)}: ${expr},`);
  }
  return lines;
}

function injectOpencodeCompactionBridge(text, intents) {
  const startIdx = text.indexOf(OPENCODE_HOOKS_GEN_START);
  const endIdx = text.indexOf(OPENCODE_HOOKS_GEN_END);
  if (startIdx < 0 || endIdx < 0 || endIdx < startIdx) {
    throw new Error(
      "OpenCode aegis.js is missing the AEGIS:HOOKS-GEN marker region — cannot inject the handler map.",
    );
  }
  // OpenCode's Hooks interface declares these handlers as flat, quoted, dotted
  // property names (verified against the installed @opencode-ai/plugin type
  // contract, dist/index.d.ts, OpenCode 1.18.3). Emitting a nested object literal
  // instead declares different properties and the handlers are never invoked, with
  // no error. Keys below are the canonical x-opencode.event values, verbatim.
  const body = [
    OPENCODE_HOOKS_GEN_START,
    "// OpenCode resolves plugin hooks by LITERAL flat dotted key (@opencode-ai/plugin",
    "// dist/index.d.ts). A nested binding such as `experimental: { session: { compacting } }`",
    "// declares a different property and is silently never invoked. Keys come verbatim",
    "// from canonical hooks/*.json `x-opencode.event`.",
    "function aegisHookHandlers(ctx) {",
    "  return {",
    ...generateOpencodeHandlerMap(intents),
    "  };",
    "}",
    OPENCODE_HOOKS_GEN_END,
  ].join("\n");
  const before = text.slice(0, startIdx);
  const after = text.slice(endIdx + OPENCODE_HOOKS_GEN_END.length);
  return before + body + after;
}

function projectOpencodeHooks(intents) {
  const path = join(REPO, ".opencode", "plugins", "aegis.js");
  if (!existsSync(path)) return 0;
  const original = readFileSync(path, "utf8");
  const next = injectOpencodeCompactionBridge(original, intents);
  if (next !== original) {
    atomicWrite(path, next);
    return 1;
  }
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook version-stamping (D1)
// ─────────────────────────────────────────────────────────────────────────────
//
// Every projected hook carries a version stamp on the line right after its
// shebang, so a deployed hook can be matched back to the Aegis release that
// produced it. The comment syntax adapts to the hook language (shell `#`,
// JS `//`). The version is resolved dynamically from package.json at projection
// time (PKG_VERSION) — never hardcoded — so a version bump + re-projection
// re-stamps automatically. Writes go through atomicWrite (no partial hook files).

const HOOK_STAMP_PREFIX = "aegis-hook-version:";

// Comment syntax per hook file extension.
function hookCommentSyntax(file) {
  if (file.endsWith(".sh") || file.endsWith(".bash")) return "#";
  if (file.endsWith(".js") || file.endsWith(".mjs") || file.endsWith(".cjs") || file.endsWith(".ts")) return "//";
  return "#"; // safe default
}

// Inject/refresh the version stamp on the line after the shebang. Idempotent:
// an existing stamp (any version) is replaced, so re-running never stacks stamps.
function stampHookContent(content, commentToken, version) {
  const stampLine = `${commentToken} ${HOOK_STAMP_PREFIX} ${version}`;
  const stampRe = new RegExp(`^\\s*(#|//)\\s*${HOOK_STAMP_PREFIX}`);

  let lines = content.split("\n");
  const insertAt = lines[0] && lines[0].startsWith("#!") ? 1 : 0; // after shebang

  // Drop ANY pre-existing stamp in the top region, not just the single line at
  // insertAt — robust to a blank line or comment drifting in above it, so
  // re-running never stacks duplicate stamps.
  lines = lines.filter((l, i) => !(i >= insertAt && i <= insertAt + 4 && stampRe.test(l)));
  lines.splice(insertAt, 0, stampLine);
  return lines.join("\n");
}

// Stamp every projected command hook, then prune anything in
// `.claude-plugin/hooks/` no live intent references. The file list is DERIVED from
// the canonical intents (every x-claude.dispatch:"command" command path), so a new
// .sh/.mjs hook auto-stamps with no hardcoded list to maintain.
//
// The prune mirrors projectCodexHooks(): a hook either ships (some hooks/*.json
// binds it via x-claude.command) or it is gone. Stamping alone is not enough —
// deleting an intent left its script on disk, shipped inside the plugin and
// reachable by anything that discovers the directory by convention, while nothing
// in canonical mentioned it any more. `HOOK_INTENT` hard-fails on the same
// condition, so an orphan cannot survive a projector that was never re-run.
//
// Three properties keep the prune safe, because a delete-by-default loop is only
// as good as its escape hatches:
//   - FLAT ONLY. A directory raises instead of being removed. `.claude-plugin/
//     hooks/` is flat by contract (the x-claude.command regex allows no `/`), so
//     a directory is an authoring error — and reaping it recursively could take a
//     correctly-referenced script down with it.
//   - HELPERS ARE EXEMPT. A `_`-prefixed entry is a shared library sourced by hook
//     scripts, not an orphan; nothing binds it via x-claude.command by design. The
//     test is the shared isHookHelper() — the HOOK_INTENT orphan rule calls the
//     same predicate, so the two cannot drift apart.
//   - DELETIONS ARE PRINTED. Every pruned path goes to stdout. A silent prune is
//     invisible to the author and to the gate, which is exactly how it would eat
//     a file nobody notices until a user's hook breaks at runtime.
function projectHooks(intents) {
  const HOOK_FILES = hookFilesFromIntents(intents ?? []);
  let stamped = 0;
  for (const path of HOOK_FILES) {
    if (!existsSync(path)) continue;
    const original = readFileSync(path, "utf8");
    const token = hookCommentSyntax(basename(path));
    const next = stampHookContent(original, token, PKG_VERSION);
    if (next !== original) {
      atomicWrite(path, next); // atomicWrite preserves the hook's +x bit
      stamped++; // count only hooks actually (re)written
    }
  }

  const claudeHooksDir = join(REPO, ".claude-plugin", "hooks");
  if (existsSync(claudeHooksDir)) {
    const expected = new Set(HOOK_FILES.map((p) => basename(p)));
    for (const entry of readdirSync(claudeHooksDir).sort()) {
      if (expected.has(entry)) continue;
      if (isHookHelper(entry)) continue; // shared helper, not an orphan
      const target = join(claudeHooksDir, entry);
      // Never delete a tree. `.claude-plugin/hooks/` is FLAT (the x-claude.command
      // regex enforces it), so a directory here is an authoring error, not an
      // orphan to reap — raise it instead of silently destroying whatever is
      // inside, which could include a correctly-referenced script.
      if (statSync(target).isDirectory()) {
        throw new Error(
          `.claude-plugin/hooks/${entry} is a directory — this tree is flat. ` +
            "Move the script to .claude-plugin/hooks/<name>.sh and point " +
            "x-claude.command at it, or delete the directory by hand.",
        );
      }
      rmSync(target, { force: true }); // no `recursive` — a directory must throw, never vanish
      // A deletion is never silent: an unobservable prune is how a destructive
      // bug hides from both the author and the gate.
      console.log(`  pruned orphan hook: .claude-plugin/hooks/${entry}`);
    }
  }

  return stamped;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

console.log(`Aegis projector — v${PKG_VERSION}`);
console.log("");

const hookIntents = loadHookIntents();

const agentCount = projectAgents();
console.log(`✓ Projected ${agentCount} agents to .opencode/agents/`);

const cmdCount = projectCommands();
console.log(`✓ Projected ${cmdCount} commands to .opencode/commands/`);

const codex = projectCodex(hookIntents);
console.log(
  "✓ Projected Codex tree (" +
    codex.skills +
    " skills, " +
    codex.agents +
    " agents-as-skills, " +
    codex.commands +
    " commands-as-dispatchers, rules → .codex-plugin/AGENTS.md; plugin manifest + .mcp.json → .codex/plugins/aegis/.codex-plugin/; marketplace → .agents/plugins/; " +
    codex.hooks +
    " hook(s) bundled → .codex/plugins/aegis/hooks/" +
    (codex.hooks === 0 ? " (none bound — plugin.json hooks: {} suppresses discovery)" : "") +
    ")",
);

const statuslineCount = projectStatuslines();
console.log(`✓ Projected ${statuslineCount} statusline presets to adapters/claude/statuslines/ (+ subagent variant)`);

projectClaudeMarketplace();
console.log("✓ Projected Claude marketplace → .claude-plugin/marketplace.json (string source)");

const claude = projectClaude(hookIntents);
console.log(
  "✓ Projected Claude tree (" +
    claude.skills +
    " skills, " +
    claude.agents +
    " agents, " +
    claude.commands +
    " commands → adapters/claude/{skills,agents,commands}/; regenerated plugin.json skills/commands/hooks/agents/userConfig/dependencies)",
);

const opencodeHookRegions = projectOpencodeHooks(hookIntents);
console.log(`✓ Projected OpenCode compaction region in .opencode/plugins/aegis.js (${opencodeHookRegions} region rewritten)`);

const hookCount = projectHooks(hookIntents);
console.log(`✓ Stamped ${hookCount} hook(s) with aegis-hook-version: ${PKG_VERSION}`);

const elapsedMs = Date.now() - start;
console.log("");
console.log(`Done in ${elapsedMs}ms.`);
console.log("");
console.log("Generated by projectClaude():");
console.log("  - adapters/claude/skills/<scope>/<name>/SKILL.md (+ abilities/references/rules siblings)");
console.log("  - adapters/claude/agents/<name>.md (tools/disallowedTools from manifest/permissions.json)");
console.log("  - adapters/claude/commands/<name>.md (Claude-native frontmatter)");
console.log("  - .claude-plugin/plugin.json → skills, commands, hooks, agents, userConfig, dependencies blocks");
console.log("");
console.log("Generated by generateClaudeHooksBlock() / projectOpencodeHooks():");
console.log("  - .claude-plugin/plugin.json → hooks block from canonical hooks/*.json");
console.log("  - .opencode/plugins/aegis.js → AEGIS:HOOKS-GEN compaction region");
console.log("");
console.log("Generated by projectHooks():");
console.log("  - command hooks under .claude-plugin/hooks/ → aegis-hook-version stamp after shebang (D1)");
console.log("");
console.log("Hand-maintained:");
console.log("  - .claude-plugin/plugin.json → name, displayName, version, description, author, license, keywords");
console.log("  - .opencode/plugins/aegis.js (except the AEGIS:HOOKS-GEN region)");
console.log("  - .opencode/INSTALL.md");
console.log("  - .codex/INSTALL.md");
console.log("");
console.log("Generated by projectCodexPluginManifest() + projectCodexMarketplaces():");
console.log("  - .codex/plugins/aegis/.codex-plugin/plugin.json (skills/mcpServers pointers + keywords; hooks: {} unless a canonical intent binds codex)");
console.log("  - .codex/plugins/aegis/.mcp.json (empty mcpServers stub)");
console.log("  - .agents/plugins/marketplace.json (Codex marketplace, object source form)");
console.log("");
console.log("Generated by projectClaudeMarketplace() (v0.3.4):");
console.log("  - .claude-plugin/marketplace.json (Claude marketplace, string source \"./\")");
console.log("");
console.log("Generated by projectCodexHooks():");
console.log(
  codex.hooks === 0
    ? "  - .codex/plugins/aegis/hooks/ — not shipped (no intent binds codex; plugin_hooks is removed, codex-cli 0.144.6)"
    : `  - .codex/plugins/aegis/hooks/hooks.json (Codex matcher-group shape, ${codex.hooks} events)`,
);
console.log("");
console.log("Future projections:");
console.log("  v0.0.6: dist/aegis.skill bundle (E2), dependencies population (E1)");
