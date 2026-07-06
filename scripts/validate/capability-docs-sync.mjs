// capability-docs-sync.mjs — section 12: capability docs in sync (A2). Delegate to
// sync-capabilities.mjs --check (it owns the generated-doc format). Shelling out
// avoids importing a CLI script that runs on import. Non-zero exit means
// docs/harnesses.md or docs/capability-matrix.md drifted from manifest/capabilities.json.
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const id = "CAPABILITY_DOCS_SYNC";

export function run() {
  const errors = [];
  const warnings = [];

  const syncScript = fileURLToPath(new URL("../sync-capabilities.mjs", import.meta.url));
  if (existsSync(syncScript)) {
    try {
      execFileSync(process.execPath, [syncScript, "--check"], { stdio: "pipe" });
    } catch {
      errors.push("capability docs out of sync — run `node scripts/sync-capabilities.mjs` (docs/harnesses.md + docs/capability-matrix.md drifted from manifest/capabilities.json)");
    }
  }

  return { errors, warnings };
}
