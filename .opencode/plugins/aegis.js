/**
 * Aegis plugin for OpenCode.
 *
 * Three responsibilities:
 *   1. Register Aegis's canonical skill directories (`skills/core`, `skills/languages`,
 *      `skills/workflows`) via `config.skills.paths`. OpenCode does not recurse into
 *      scope subdirectories by default; this pushes the three absolute paths so all
 *      82 SKILL.md files are discoverable.
 *   2. Register the 17 Aegis agents and 6 Aegis commands inline via `config.agent.<name>`
 *      and `config.command.<name>`. OpenCode supports JSON inline config for both
 *      surfaces (see docs/official/{agents,commands}.md). The plugin reads each
 *      canonical .md file at boot, strips frontmatter, and inlines the body — so no
 *      symlinking into `~/.config/opencode/agents/` or `commands/` is required.
 *   3. Inject the `using-aegis` SKILL.md body into the first user message of each
 *      session via `experimental.chat.messages.transform`. Guarded by an HTML-comment
 *      marker (`<!-- aegis:bootstrap -->`) to prevent double-injection.
 *
 * The plugin is plain ESM JavaScript. No build step. No dependencies beyond Node's
 * standard library. Targets Node 20+.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Resolve the real path of this file so symlinks at the install location
// (`~/.config/opencode/plugins/aegis.js` pointing back into a local Aegis clone)
// still resolve `aegisRoot` to the actual repo, not the symlink directory.
const __filename = fs.realpathSync(fileURLToPath(import.meta.url));
const __dirname = path.dirname(__filename);

// Aegis repo root is two levels up from `.opencode/plugins/`.
// Override via `AEGIS_REPO_ROOT` env var when neither the in-repo install nor
// the symlink-from-global install fits.
const aegisRoot = process.env.AEGIS_REPO_ROOT
  ? path.resolve(process.env.AEGIS_REPO_ROOT)
  : path.resolve(__dirname, "..", "..");

const BOOTSTRAP_MARKER = "<!-- aegis:bootstrap -->";

const SKILL_DIRS = [
  path.join(aegisRoot, "skills", "core"),
  path.join(aegisRoot, "skills", "languages"),
  path.join(aegisRoot, "skills", "workflows"),
];

const AGENTS_DIR = path.join(aegisRoot, ".opencode", "agents");
const COMMANDS_DIR = path.join(aegisRoot, ".opencode", "commands");

let _bootstrapCache;
let _permissionsCache;

function stripFrontmatter(content) {
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return match ? match[1] : content;
}

// Minimal YAML parser for the lean frontmatter shape Aegis projection emits.
// Supports: `key: value`, `key: 'quoted'`, `key: "quoted"`. Not nested objects.
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { fm: {}, body: content };
  const fm = {};
  for (const line of match[1].split("\n")) {
    const m = line.match(/^([a-zA-Z][a-zA-Z0-9_-]*):\s*(.*)$/);
    if (!m) continue;
    fm[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return { fm, body: match[2] };
}

function loadBootstrap() {
  if (_bootstrapCache !== undefined) return _bootstrapCache;

  const bootstrapPath = path.join(aegisRoot, "skills", "core", "using-aegis", "SKILL.md");
  if (!fs.existsSync(bootstrapPath)) {
    throw new Error(
      `Aegis plugin: bootstrap skill missing at ${bootstrapPath}. Plugin cannot inject session context without it.`,
    );
  }
  const raw = fs.readFileSync(bootstrapPath, "utf8").trim();
  if (raw.length === 0) {
    throw new Error(`Aegis plugin: bootstrap skill at ${bootstrapPath} is empty.`);
  }
  _bootstrapCache = `${BOOTSTRAP_MARKER}\n${stripFrontmatter(raw).trim()}\n`;
  return _bootstrapCache;
}

// Load `manifest/permissions.json` — the single source of truth for agent
// permission posture (D1) plus the plugin-level cross-cutting deny block (D5).
// Permissions are a security boundary: a missing or malformed file is a fatal
// error, never a silent skip (matches loadBootstrap's fail-loud style).
function loadPermissions() {
  if (_permissionsCache !== undefined) return _permissionsCache;

  const permissionsPath = path.join(aegisRoot, "manifest", "permissions.json");
  if (!fs.existsSync(permissionsPath)) {
    throw new Error(
      `Aegis plugin: permissions manifest missing at ${permissionsPath}. ` +
        `Permissions are a security boundary; the plugin refuses to register agents without it.`,
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(permissionsPath, "utf8"));
  } catch (err) {
    throw new Error(
      `Aegis plugin: permissions manifest at ${permissionsPath} is not valid JSON: ${err.message}`,
    );
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Aegis plugin: permissions manifest at ${permissionsPath} is not an object.`);
  }
  _permissionsCache = parsed;
  return _permissionsCache;
}

// Translate the Claude-style `plugin.deny[]` strings from permissions.json into
// OpenCode's global `permission` block (D5). Per the per-agent-permissions-matrix
// "OpenCode-equivalent" mapping and references/opencode-docs/docs/12-permissions.md
// ("Granular Permission Objects"):
//   - `Read(<glob>)` denies  -> permission.read.{<glob>: "deny"}
//   - `Bash(<cmd>)`  denies  -> permission.bash.{<cmd>: "deny"}
// `~` is preserved verbatim (OpenCode expands `~`/`$HOME` itself). A leading
// `./` is stripped to a `**/`-anchored glob so the deny matches at any depth,
// matching the docs' `**/secrets/**` example.
function applyGlobalDeny(permission, denyList) {
  if (!Array.isArray(denyList)) return;

  const toReadGlob = (inner) => {
    let g = inner.trim();
    if (g.startsWith("./")) {
      g = g.slice(2);
      // Anchor at any depth, mirroring the docs' `**/secrets/**` form.
      g = g.startsWith("**/") ? g : `**/${g}`;
    }
    return g;
  };

  for (const raw of denyList) {
    if (typeof raw !== "string") continue;
    const m = raw.match(/^([A-Za-z]+)\((.*)\)$/);
    if (!m) continue;
    const tool = m[1];
    const inner = m[2];

    if (tool === "Read") {
      if (typeof permission.read === "string") continue; // user pinned a scalar; don't clobber
      permission.read ??= {};
      const glob = toReadGlob(inner);
      if (!(glob in permission.read)) permission.read[glob] = "deny";
    } else if (tool === "Bash") {
      if (typeof permission.bash === "string") continue; // user pinned a scalar; don't clobber
      permission.bash ??= {};
      const cmd = inner.trim();
      if (!(cmd in permission.bash)) permission.bash[cmd] = "deny";
    }
    // Other tool denies have no OpenCode global-permission equivalent; honest gap.
  }
}

// Build a `cfg.agent.<name>` entry from a generated .opencode/agents/<name>.md file.
function buildAgentEntries(dir) {
  if (!fs.existsSync(dir)) return {};
  const entries = {};
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".md")) continue;
    const name = file.replace(/\.md$/, "");
    const raw = fs.readFileSync(path.join(dir, file), "utf8");
    const { fm, body } = parseFrontmatter(raw);
    if (!fm.description) continue;
    entries[`aegis-${name}`] = {
      description: fm.description,
      mode: fm.mode || "subagent",
      prompt: body.trim(),
    };
  }
  return entries;
}

// Build a `cfg.command.<name>` entry from a generated .opencode/commands/<name>.md file.
function buildCommandEntries(dir) {
  if (!fs.existsSync(dir)) return {};
  const entries = {};
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".md")) continue;
    const name = file.replace(/\.md$/, "");
    const raw = fs.readFileSync(path.join(dir, file), "utf8");
    const { fm, body } = parseFrontmatter(raw);
    if (!fm.description) continue;
    const entry = {
      description: fm.description,
      template: body.trim(),
    };
    entries[`aegis-${name}`] = entry;
  }
  return entries;
}

// Compaction bridge for `experimental.session.compacting`. OpenCode fires this
// once, before compaction starts: `input {sessionID}` → `output {context: string[],
// prompt?}`. Deliberate no-op placeholder — Aegis's anchor capture needs durable
// cross-turn state the plugin has no store for. Registered so the binding is real
// and inspectable; see adapters/opencode/projection.md for the declared gap.
const aegisCompaction = async (_input, _output) => {};

// Bootstrap injection for `experimental.chat.messages.transform`. Returns the
// handler bound into the generated map below. Injects the `using-aegis` body into
// the first USER message (not a system message), guarded by BOOTSTRAP_MARKER so
// re-entry never double-injects.
function aegisBootstrapTransform(ctx) {
  return async (_input, output) => {
    const messages = output?.messages;
    if (!Array.isArray(messages) || messages.length === 0) return;

    const firstUser = messages.find((m) => m?.info?.role === "user");
    if (!firstUser || !Array.isArray(firstUser.parts) || firstUser.parts.length === 0) {
      return;
    }

    const alreadyInjected = firstUser.parts.some(
      (p) => p?.type === "text" && typeof p.text === "string" && p.text.includes(BOOTSTRAP_MARKER),
    );
    if (alreadyInjected) return;

    const reference = firstUser.parts[0];
    firstUser.parts.unshift({
      ...reference,
      type: "text",
      text: ctx.bootstrap,
    });
  };
}

// >>> AEGIS:HOOKS-GEN (generated by scripts/project.mjs — do not edit) >>>
// OpenCode resolves plugin hooks by LITERAL flat dotted key (@opencode-ai/plugin
// dist/index.d.ts). A nested binding such as `experimental: { session: { compacting } }`
// declares a different property and is silently never invoked. Keys come verbatim
// from canonical hooks/*.json `x-opencode.event`.
function aegisHookHandlers(ctx) {
  return {
    "experimental.session.compacting": aegisCompaction,
    "experimental.chat.messages.transform": aegisBootstrapTransform(ctx),
  };
}
// <<< AEGIS:HOOKS-GEN <<<

export const AegisPlugin = async () => {
  const bootstrap = loadBootstrap();
  const permissions = loadPermissions();
  const agentEntries = buildAgentEntries(AGENTS_DIR);
  const commandEntries = buildCommandEntries(COMMANDS_DIR);

  return {
    /**
     * Register Aegis surfaces into the live OpenCode config.
     * OpenCode calls `config(cfg)` at boot; `cfg` is the live config object.
     */
    config: async (cfg) => {
      if (!cfg || typeof cfg !== "object") return;

      // Skills: filesystem discovery via skill paths.
      cfg.skills ??= {};
      cfg.skills.paths ??= [];
      for (const dir of SKILL_DIRS) {
        if (!cfg.skills.paths.includes(dir)) cfg.skills.paths.push(dir);
      }

      // Agents: inline JSON registration.
      cfg.agent ??= {};
      for (const [name, entry] of Object.entries(agentEntries)) {
        if (!cfg.agent[name]) cfg.agent[name] = entry;
      }

      // Per-agent permissions (D4). OpenCode does not honour `permission:` in
      // agent markdown frontmatter — it must live under `agent.<name>.permission`
      // in config. Manifest keys are bare names (`code-reviewer`); the registered
      // OpenCode agent names are `aegis-<name>`. Set `.permission` only when absent
      // so user-pinned overrides and re-runs of this hook are not clobbered.
      const agentPerms = permissions.agents ?? {};
      for (const [bareName, spec] of Object.entries(agentPerms)) {
        const agentKey = `aegis-${bareName}`;
        const target = cfg.agent[agentKey];
        if (!target) continue; // agent not registered (e.g. its .md absent); skip.
        if (target.permission === undefined && spec && spec.opencode) {
          target.permission = spec.opencode;
        }
      }

      // Global cross-cutting deny (D5). Translate `plugin.deny[]` into OpenCode's
      // global `permission.read` / `permission.bash` glob maps. Merge without
      // clobbering existing user entries.
      cfg.permission ??= {};
      applyGlobalDeny(cfg.permission, permissions.plugin?.deny);

      // Commands: inline JSON registration.
      cfg.command ??= {};
      for (const [name, entry] of Object.entries(commandEntries)) {
        if (!cfg.command[name]) cfg.command[name] = entry;
      }
    },

    // Lifecycle handlers, keyed by OpenCode's literal flat dotted hook names. The
    // key strings are projector-generated from canonical hooks/*.json — never
    // hand-written here, and never nested.
    ...aegisHookHandlers({ bootstrap }),
  };
};

export default AegisPlugin;
export const server = AegisPlugin;
