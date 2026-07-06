// manifest.mjs — sections 6 + 7: manifest + schema exist and are valid JSON.
import { existsSync } from "node:fs";
import { join } from "node:path";

export const id = "MANIFEST";

export function run(ctx) {
  const { REPO } = ctx;
  const errors = [];
  const warnings = [];

  // 6. Manifest exists and is valid JSON.
  const manifestPath = join(REPO, "manifest/aegis.manifest.json");
  if (!existsSync(manifestPath)) {
    errors.push("missing manifest/aegis.manifest.json");
  } else {
    try {
      JSON.parse(ctx.read(manifestPath));
    } catch (e) {
      errors.push(`manifest/aegis.manifest.json invalid JSON: ${e.message}`);
    }
  }

  // 7. Schema exists and is valid JSON.
  const schemaPath = join(REPO, "manifest/schemas/aegis-surface.schema.json");
  if (!existsSync(schemaPath)) {
    errors.push("missing manifest/schemas/aegis-surface.schema.json");
  } else {
    try {
      JSON.parse(ctx.read(schemaPath));
    } catch (e) {
      errors.push(`schema invalid JSON: ${e.message}`);
    }
  }

  return { errors, warnings };
}
