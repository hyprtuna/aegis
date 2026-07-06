// capabilities.mjs — v0.0.5 passes B + C: new-manifest JSON/schema validity and
// the F1 capability-matrix lint. Hand-rolled, like sections 6/7.
import { existsSync } from "node:fs";
import { join } from "node:path";

export const id = "CAPABILITIES";

const NEW_MANIFEST_FILES = [
  "manifest/capabilities.json",
  "manifest/models.json",
  "manifest/permissions.json",
  "manifest/schemas/capability.schema.json",
  "manifest/schemas/permissions.schema.json",
];

export function run(ctx) {
  const { REPO } = ctx;
  const errors = [];
  const warnings = [];

  // B. New-manifest JSON + schema validity.
  const parsedManifests = {};
  for (const rel of NEW_MANIFEST_FILES) {
    const full = join(REPO, rel);
    if (!existsSync(full)) {
      errors.push(`missing required manifest file: ${rel}`);
      continue;
    }
    try {
      parsedManifests[rel] = JSON.parse(ctx.read(full));
    } catch (e) {
      errors.push(`${rel} invalid JSON: ${e.message}`);
    }
  }

  // C. F1 capability-matrix lint.
  const caps = parsedManifests["manifest/capabilities.json"];
  if (caps) {
    const list = Array.isArray(caps.capabilities) ? caps.capabilities : null;
    if (!list) {
      errors.push("manifest/capabilities.json: 'capabilities' must be an array");
    } else {
      const REQUIRED_HOSTS = ["claude", "opencode", "codex", "cursor", "zed"];
      const VALID_STATUS = new Set(["supported", "partial", "gap", "n/a"]);
      const seenIds = new Set();
      for (const cap of list) {
        const id = cap && cap.id ? cap.id : "<missing-id>";
        if (!cap || typeof cap !== "object") {
          errors.push("capabilities.json: each capability must be an object");
          continue;
        }
        if (!cap.id) errors.push("capabilities.json: capability missing 'id'");
        else if (seenIds.has(cap.id)) errors.push(`capabilities.json: duplicate capability id '${cap.id}'`);
        else seenIds.add(cap.id);
        const hosts = cap.hosts && typeof cap.hosts === "object" ? cap.hosts : null;
        if (!hosts) {
          errors.push(`capabilities.json: capability '${id}' missing 'hosts' object`);
          continue;
        }
        for (const h of REQUIRED_HOSTS) {
          const he = hosts[h];
          if (!he || typeof he !== "object") {
            errors.push(`capabilities.json: capability '${id}' missing host key '${h}'`);
            continue;
          }
          if (!VALID_STATUS.has(he.status)) {
            errors.push(`capabilities.json: capability '${id}' host '${h}' has invalid status '${he.status}'`);
          }
          if ((he.status === "supported" || he.status === "partial") &&
              (typeof he.evidence !== "string" || he.evidence.trim() === "")) {
            errors.push(`capabilities.json: capability '${id}' host '${h}' is '${he.status}' but has no non-empty 'evidence'`);
          }
          // Optional soft check: bare repo-relative path evidence (no #anchor, no :line)
          // that does not resolve. Anchors and file:line refs are NOT resolved (per spec).
          if (typeof he.evidence === "string" && he.evidence.trim() !== "" &&
              !he.evidence.includes("#") && !he.evidence.includes(":") &&
              /^[A-Za-z0-9_.\/-]+$/.test(he.evidence) && /\.[A-Za-z0-9]+$/.test(he.evidence)) {
            if (!existsSync(join(REPO, he.evidence))) {
              warnings.push(`capabilities.json: capability '${id}' host '${h}' evidence path '${he.evidence}' does not exist`);
            }
          }
        }
      }
    }
  }

  return { errors, warnings };
}
