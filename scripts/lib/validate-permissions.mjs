// validate-permissions.mjs — D7 permission-drift validator (importable, pure).
//
// Exports validatePermissions(REPO) -> { errors: string[], warnings: string[] }.
// No process.exit, no console, no deps. Node 20+ stdlib only.
//
// Checks (per ag-0008-agent-permissions/decisions.md D7):
//   1. Coverage      — every canonical agent has a permissions.json entry, and vice versa.
//   2. Schema        — each entry has bucket/claude/opencode; bucket ∈ 9 known; claude.tools non-empty array.
//   3. Claude drift  — generated adapters/claude/agents/<name>.md frontmatter tools: == claude.tools (order-insensitive).
//   4. Prose drift   — body read-only claims must not contradict an elevated (Edit/Write/Bash) claude.tools.
//
// Architecture note: generated Claude agents live at adapters/claude/agents/<name>.md
// (per host-docs DH1), NOT .claude-plugin/agents/ — D3/D7's path predates that decision.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const KNOWN_BUCKETS = new Set([
  "RO",
  "RO-web",
  "RO-bash",
  "RW",
  "RW-bash",
  "Full",
  "Full+Task",
  "Full+Task+Web",
  "Task-only",
]);

// Read-only buckets MUST disallow Edit/Write (agent-safety metadata, the model+disallow drift guard).
// Every other (mutating/doer) bucket must NOT carry that disallow.
const RO_BUCKETS = new Set(["RO", "RO-web", "RO-bash"]);

// Known model tiers (canonical aliases) every agent must declare.
// `fable` (Claude Fable 5) was added in v0.1.0. `best` is an aliasOf synonym, not a
// declarable tier (agents declare canonical tiers; synonyms resolve through models.json).
const KNOWN_MODEL_TIERS = new Set(["opus", "sonnet", "haiku", "fable"]);

// Tools every RO bucket must deny.
const REQUIRED_RO_DISALLOW = ["Edit", "Write"];

// Read-only-claim regexes scanned against the agent BODY (frontmatter stripped).
// Two tiers:
//   MUTATION  — claims the agent does not Edit/Write ("read-only", "never modify code").
//               Contradicted by Edit/Write or a bare full-shell Bash (which can write files).
//   NO_SHELL  — claims the agent has no shell access at all.
//               Additionally contradicted even by a scoped Bash(...) test-runner.
// Patterns are anchored to SELF-DIRECTED assertions (start of a line/sentence) so we
// do NOT fire on prose describing OTHER agents (e.g. a dispatched "read-only reviewer"
// or a "read-only exploration" tier label).
const MUTATION_CLAIM_PATTERNS = [
  /^[-*\s>]*read-only\b/im, // line begins with a "Read-only." self-assertion
  /\bis read-only\b/i,
  /you are\b[^.\n]*\bread-only\b/i,
  /you do not (?:write|edit|execute)/i,
  /never modify code/i,
  /only tools are read,?\s*glob,?\s*and grep/i,
  /read\/glob\/grep only/i,
];
const NO_SHELL_CLAIM_PATTERNS = [
  /no shell access/i,
  /no shell commands/i,
  /no bash/i,
];

// Lines that mention another agent file or name another agent in parentheses are
// descriptions of dispatched subagents, not self-claims — exclude them.
function isCrossReferenceLine(line) {
  return /agents\/[a-z0-9-]+\.md/i.test(line) ||
         /\(e\.g\.\s*[`a-z]/i.test(line) ||
         /dispatch[^.]*read-only/i.test(line);
}

// Scan body lines for a self-directed read-only claim of the given tier.
function matchSelfClaim(body, patterns) {
  for (const line of body.split("\n")) {
    if (isCrossReferenceLine(line)) continue;
    const hit = patterns.find((re) => re.test(line));
    if (hit) return hit;
  }
  return null;
}

// Returns the offending tool if the agent has Edit/Write or a bare full-shell Bash.
function hasMutationTool(tools) {
  for (const t of tools) {
    if (t === "Edit" || t === "Write" || t === "Bash") return t;
  }
  return null;
}
// Returns any shell tool (bare or scoped) — used only for "no shell access" claims.
function hasAnyShellTool(tools) {
  for (const t of tools) {
    if (t === "Bash" || /^Bash\(/.test(t)) return t;
  }
  return null;
}

// Split a markdown file into { frontmatter, body }. Returns frontmatter = null
// when there is no leading `---\n ... \n---` block.
function splitFrontmatter(text) {
  if (!text.startsWith("---\n")) return { frontmatter: null, body: text };
  const end = text.indexOf("\n---", 4);
  if (end < 0) return { frontmatter: null, body: text };
  return { frontmatter: text.slice(4, end), body: text.slice(end + 4) };
}

// Parse a frontmatter `tools:` value into an array of strings. Handles the flow
// form the projector emits: `tools: [Read, Grep, Glob, 'Bash(npm test*)']`.
// Returns null if no tools key is present.
function parseToolsLine(frontmatter) {
  const m = frontmatter.match(/^tools:\s*(.+?)\s*$/m);
  if (!m) return null;
  let raw = m[1].trim();
  // Strip surrounding brackets if present.
  if (raw.startsWith("[") && raw.endsWith("]")) raw = raw.slice(1, -1);
  if (raw === "") return [];
  // Split on commas that are not inside parentheses (Bash(...) may contain commas).
  const parts = [];
  let depth = 0;
  let cur = "";
  for (const ch of raw) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim() !== "") parts.push(cur);
  return parts.map((p) => p.trim().replace(/^['"]|['"]$/g, ""));
}

// Parse a frontmatter `disallowedTools:` value into an array of strings. Same
// flow form the projector emits (`disallowedTools: [Edit, Write]`). Returns null
// when the key is absent (omitted = no denials).
function parseDisallowedLine(frontmatter) {
  const m = frontmatter.match(/^disallowedTools:\s*(.+?)\s*$/m);
  if (!m) return null;
  let raw = m[1].trim();
  if (raw.startsWith("[") && raw.endsWith("]")) raw = raw.slice(1, -1);
  if (raw === "") return [];
  return raw
    .split(",")
    .map((p) => p.trim().replace(/^['"]|['"]$/g, ""))
    .filter((p) => p !== "");
}

// Parse a frontmatter `model:` value (scalar). Returns null when absent.
function parseModelLine(frontmatter) {
  const m = frontmatter.match(/^model:\s*(.+?)\s*$/m);
  if (!m) return null;
  return m[1].trim().replace(/^['"]|['"]$/g, "");
}

// Resolve a canonical model alias (opus/sonnet/haiku) to its Claude-native ID via
// manifest/models.json — mirrors scripts/project.mjs resolveClaudeModel. Returns
// null when the alias is unknown or resolves to "inherit".
function resolveClaudeModelId(models, alias) {
  if (!alias || alias === "inherit" || !models || !models.aliases) return null;
  const canonical = models.aliases[alias] ? alias : models.aliasOf?.[alias];
  if (!canonical || !models.aliases[canonical]) return null;
  const id = models.aliases[canonical].claude;
  return id === "inherit" ? null : id;
}

// Extract the canonical agent name from frontmatter (falls back to filename stem).
function agentNameFromFrontmatter(frontmatter, fileStem) {
  if (frontmatter) {
    const m = frontmatter.match(/^name:\s*(.+)$/m);
    if (m) return m[1].trim().replace(/^['"]|['"]$/g, "");
  }
  return fileStem;
}

// Order-insensitive array equality of strings.
function sameSet(a, b) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

export function validatePermissions(REPO) {
  const errors = [];
  const warnings = [];

  const permsPath = join(REPO, "manifest/permissions.json");
  if (!existsSync(permsPath)) {
    errors.push("missing manifest/permissions.json (permission validator)");
    return { errors, warnings };
  }

  let perms;
  try {
    perms = JSON.parse(readFileSync(permsPath, "utf8"));
  } catch (e) {
    errors.push(`manifest/permissions.json invalid JSON: ${e.message}`);
    return { errors, warnings };
  }

  const agentEntries = perms.agents && typeof perms.agents === "object" ? perms.agents : {};

  // Load manifest/models.json so generated `model:` IDs can be checked against the
  // resolved manifest alias (model + disallow drift guard). A missing/malformed
  // models manifest is non-fatal here — the coverage check still validates the alias
  // tier; drift resolution simply falls back to comparing the raw alias.
  let models = null;
  const modelsPath = join(REPO, "manifest/models.json");
  if (existsSync(modelsPath)) {
    try {
      models = JSON.parse(readFileSync(modelsPath, "utf8"));
    } catch {
      models = null;
    }
  }

  // Enumerate canonical agents (agents/*.md, excluding guidance files).
  const agentsDir = join(REPO, "agents");
  const canonicalAgents = new Map(); // name -> { file, frontmatter, body }
  if (existsSync(agentsDir)) {
    for (const file of readdirSync(agentsDir)) {
      if (!file.endsWith(".md")) continue;
      if (file === "AGENTS.md" || file === "CLAUDE.md") continue;
      const full = join(agentsDir, file);
      const text = readFileSync(full, "utf8");
      const { frontmatter, body } = splitFrontmatter(text);
      const name = agentNameFromFrontmatter(frontmatter, file.replace(/\.md$/, ""));
      canonicalAgents.set(name, { file, frontmatter, body });
    }
  } else {
    errors.push("missing agents/ directory (permission validator)");
  }

  // --- Check 1: Coverage ---
  for (const name of canonicalAgents.keys()) {
    if (!Object.prototype.hasOwnProperty.call(agentEntries, name)) {
      errors.push(`permissions: agent '${name}' (agents/${name}.md) has no entry in manifest/permissions.json agents{}`);
    }
  }
  for (const name of Object.keys(agentEntries)) {
    if (!canonicalAgents.has(name)) {
      errors.push(`permissions: manifest entry agents.${name} has no corresponding canonical agent file agents/${name}.md`);
    }
  }

  // --- Check 2: Schema conformance (hand-rolled) ---
  for (const [name, entry] of Object.entries(agentEntries)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`permissions: agents.${name} must be an object`);
      continue;
    }
    if (!("bucket" in entry)) errors.push(`permissions: agents.${name} missing 'bucket'`);
    else if (!KNOWN_BUCKETS.has(entry.bucket)) {
      errors.push(`permissions: agents.${name} bucket '${entry.bucket}' is not one of the 9 known buckets`);
    }
    if (!("claude" in entry)) {
      errors.push(`permissions: agents.${name} missing 'claude'`);
    } else if (!entry.claude || typeof entry.claude !== "object") {
      errors.push(`permissions: agents.${name}.claude must be an object`);
    } else if (!Array.isArray(entry.claude.tools) || entry.claude.tools.length === 0) {
      errors.push(`permissions: agents.${name}.claude.tools must be a non-empty array`);
    } else if (!entry.claude.tools.every((t) => typeof t === "string")) {
      errors.push(`permissions: agents.${name}.claude.tools must contain only strings`);
    }
    if (!("opencode" in entry)) {
      errors.push(`permissions: agents.${name} missing 'opencode'`);
    } else if (!entry.opencode || typeof entry.opencode !== "object" || Array.isArray(entry.opencode)) {
      errors.push(`permissions: agents.${name}.opencode must be an object`);
    }
  }

  // --- Check 2b: model + disallowedTools COVERAGE (agent-safety metadata) ---
  // Every agent must declare a claude.model from the known tier set, and a
  // disallowedTools array consistent with its bucket: read-only buckets MUST
  // disallow Edit,Write; mutating/doer buckets MUST NOT.
  for (const [name, entry] of Object.entries(agentEntries)) {
    if (!entry || typeof entry !== "object" || !entry.claude || typeof entry.claude !== "object") {
      continue; // schema check already flagged it
    }
    const claude = entry.claude;

    // model coverage: present + a known tier.
    if (!("model" in claude)) {
      errors.push(`permissions: agents.${name}.claude missing 'model' (expected one of ${[...KNOWN_MODEL_TIERS].join("/")})`);
    } else if (!KNOWN_MODEL_TIERS.has(claude.model)) {
      errors.push(`permissions: agents.${name}.claude.model '${claude.model}' is not a known tier (${[...KNOWN_MODEL_TIERS].join("/")})`);
    }

    // disallowedTools consistency with the bucket.
    const isRO = RO_BUCKETS.has(entry.bucket);
    const disallow = claude.disallowedTools;
    if (isRO) {
      if (!Array.isArray(disallow)) {
        errors.push(`permissions: agents.${name} is a read-only bucket ('${entry.bucket}') and must declare claude.disallowedTools [${REQUIRED_RO_DISALLOW.join(", ")}]`);
      } else {
        for (const t of REQUIRED_RO_DISALLOW) {
          if (!disallow.includes(t)) {
            errors.push(`permissions: agents.${name} (bucket '${entry.bucket}') must disallow '${t}' but claude.disallowedTools is ${JSON.stringify(disallow)}`);
          }
        }
      }
    } else if (Array.isArray(disallow) && (disallow.includes("Edit") || disallow.includes("Write"))) {
      errors.push(`permissions: agents.${name} (mutating bucket '${entry.bucket}') must NOT disallow Edit/Write but claude.disallowedTools is ${JSON.stringify(disallow)}`);
    }
  }

  // --- Check 3: Claude tools drift ---
  const genAgentsDir = join(REPO, "adapters/claude/agents");
  for (const [name, entry] of Object.entries(agentEntries)) {
    const declared =
      entry && entry.claude && Array.isArray(entry.claude.tools) ? entry.claude.tools : null;
    if (!declared) continue; // schema check already flagged it
    const genPath = join(genAgentsDir, `${name}.md`);
    if (!existsSync(genPath)) {
      errors.push(`permissions: generated Claude agent missing: adapters/claude/agents/${name}.md (cannot verify tools drift)`);
      continue;
    }
    const { frontmatter } = splitFrontmatter(readFileSync(genPath, "utf8"));
    if (!frontmatter) {
      errors.push(`permissions: adapters/claude/agents/${name}.md has no parseable frontmatter`);
      continue;
    }
    const projected = parseToolsLine(frontmatter);
    if (projected === null) {
      errors.push(`permissions: adapters/claude/agents/${name}.md frontmatter has no 'tools:' key (manifest declares ${JSON.stringify(declared)})`);
      continue;
    }
    if (!sameSet(projected, declared)) {
      errors.push(
        `permissions: tools drift for '${name}' — adapters/claude/agents/${name}.md has tools ${JSON.stringify(projected)} but manifest/permissions.json agents.${name}.claude.tools is ${JSON.stringify(declared)}`,
      );
    }

    // model drift: the generated `model:` ID must equal the manifest alias resolved
    // through models.json. The manifest carries the alias (opus/sonnet/haiku); the
    // projector emits the Claude-native ID, so compare resolved-to-resolved.
    const declaredModel = entry.claude.model;
    if (KNOWN_MODEL_TIERS.has(declaredModel)) {
      const projectedModel = parseModelLine(frontmatter);
      const expectedModel = resolveClaudeModelId(models, declaredModel);
      if (expectedModel) {
        if (projectedModel === null) {
          errors.push(`permissions: model drift for '${name}' — adapters/claude/agents/${name}.md has no 'model:' but manifest declares model '${declaredModel}' (expected '${expectedModel}')`);
        } else if (projectedModel !== expectedModel) {
          errors.push(`permissions: model drift for '${name}' — adapters/claude/agents/${name}.md has model '${projectedModel}' but manifest alias '${declaredModel}' resolves to '${expectedModel}'`);
        }
      }
    }

    // disallowedTools drift: generated frontmatter must match the manifest array.
    // Manifest omits the key for doer agents → generated must also omit it.
    const declaredDisallow = Array.isArray(entry.claude.disallowedTools) ? entry.claude.disallowedTools : null;
    const projectedDisallow = parseDisallowedLine(frontmatter);
    if (declaredDisallow && declaredDisallow.length > 0) {
      if (projectedDisallow === null) {
        errors.push(`permissions: disallowedTools drift for '${name}' — adapters/claude/agents/${name}.md has no 'disallowedTools:' but manifest declares ${JSON.stringify(declaredDisallow)}`);
      } else if (!sameSet(projectedDisallow, declaredDisallow)) {
        errors.push(`permissions: disallowedTools drift for '${name}' — adapters/claude/agents/${name}.md has ${JSON.stringify(projectedDisallow)} but manifest declares ${JSON.stringify(declaredDisallow)}`);
      }
    } else if (projectedDisallow && projectedDisallow.length > 0) {
      errors.push(`permissions: disallowedTools drift for '${name}' — adapters/claude/agents/${name}.md has ${JSON.stringify(projectedDisallow)} but manifest declares no disallowedTools`);
    }

    // OpenCode deny-row drift: for a read-only bucket, the manifest opencode block
    // must carry edit:deny + write:deny (the Claude disallowedTools complement —
    // the `*: deny` default also covers them, but the explicit rows are the
    // intent-bearing source the runtime plugin projects verbatim).
    if (RO_BUCKETS.has(entry.bucket)) {
      const oc = entry.opencode;
      if (oc && typeof oc === "object" && !Array.isArray(oc)) {
        for (const tool of ["edit", "write"]) {
          if (oc[tool] !== "deny") {
            errors.push(`permissions: agents.${name} (read-only bucket '${entry.bucket}') must set opencode.${tool} = "deny" (got ${JSON.stringify(oc[tool])})`);
          }
        }
      }
    }
  }

  // --- Check 4: Prose-vs-declared drift lint ---
  // A "no-mutation" self-claim (read-only / never modify code) contradicts Edit/Write
  // or a bare full-shell Bash. A stronger "no shell access" self-claim additionally
  // contradicts any scoped Bash(...) test-runner. Scoped Bash test-runners alone do
  // NOT contradict a "never modify code" claim (they execute, they do not mutate),
  // which is why the RO-bash agents (test-analyzer, doc-verifier) legitimately pass.
  for (const [name, info] of canonicalAgents) {
    const entry = agentEntries[name];
    if (!entry || !entry.claude || !Array.isArray(entry.claude.tools)) continue;
    const tools = entry.claude.tools;

    const mutationTool = hasMutationTool(tools);
    if (mutationTool) {
      const claim = matchSelfClaim(info.body, MUTATION_CLAIM_PATTERNS);
      if (claim) {
        errors.push(
          `permissions: prose/declared contradiction for '${name}' — agents/${name}.md body asserts a read-only/no-mutation self-claim (matched ${claim}) but manifest grants mutating tool '${mutationTool}' in claude.tools`,
        );
        continue; // one finding per agent is enough
      }
    }

    const shellTool = hasAnyShellTool(tools);
    if (shellTool) {
      const claim = matchSelfClaim(info.body, NO_SHELL_CLAIM_PATTERNS);
      if (claim) {
        errors.push(
          `permissions: prose/declared contradiction for '${name}' — agents/${name}.md body asserts no-shell-access (matched ${claim}) but manifest grants shell tool '${shellTool}' in claude.tools`,
        );
      }
    }
  }

  return { errors, warnings };
}
