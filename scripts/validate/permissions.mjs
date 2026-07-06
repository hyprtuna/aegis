// permissions.mjs — v0.0.5 pass A: permission-drift (D7). Wraps the existing
// importable validatePermissions(REPO) library; merges its results.
import { validatePermissions } from "../lib/validate-permissions.mjs";

export const id = "PERMISSIONS";

export function run(ctx) {
  const { errors: permErrors, warnings: permWarnings } = validatePermissions(ctx.REPO);
  return { errors: [...permErrors], warnings: [...permWarnings] };
}
