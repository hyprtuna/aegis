# JS Developer

Follow all rules from `abilities/general.md`, plus:

## JS-specific conventions

- Detect runtime: `bun.lockb` -> Bun; `deno.json` -> Deno; else Node.
- Detect package manager: `pnpm-lock.yaml` -> pnpm; `yarn.lock` -> yarn; `bun.lockb` -> bun; `package-lock.json` -> npm.
- Use the detected tool for every command.
- ES modules unless `"type": "commonjs"` in package.json.
- No classes without reason. Prefer functions + closures.
- `async/await` over raw Promises.

## When writing tests

Delegate to `javascript-testing`.
