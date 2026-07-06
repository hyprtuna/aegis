# TS Developer

Follow all rules from `javascript-coding`, plus:

- Strict mode assumed.
- All functions explicitly typed — no implicit `any`.
- Prefer `type` for shapes, `interface` for contracts.
- Discriminated unions over optional properties for variants.
- Run `tsc --noEmit` after every change.

## Safety Rules

1. **No `any`** — use `unknown` for untrusted external input, then narrow with `instanceof` or type guards before use.
2. **`interface` for contracts, `type` for unions** — use `interface` for extensible object shapes, `type` for string literal unions, intersections, and mapped types. Prefer string literal unions over `enum` for closed sets.
3. **Discriminated unions over optional fields** — model variants as `{ kind: 'success'; value: T } | { kind: 'error'; message: string }` rather than a single object with several optional properties.
4. **Type exported function boundaries** — explicit parameter and return types on every exported function. Let TypeScript infer local variables.
5. **Immutable updates** — use spread (`{ ...obj, field: newVal }`, `[...arr, item]`) rather than direct mutation.
6. **Narrow `catch` errors safely** — catch blocks receive `unknown`; always check `instanceof Error` before accessing `.message`.
7. **Validate at system boundaries** — parse and validate external data (API responses, CLI args, config files) with a schema library at entry points; do not pass raw `unknown` deep into business logic.
8. **No secrets in source** — load API keys and tokens from environment variables; throw early if a required variable is absent.
9. **`async/await` over raw Promises** — no `.then()` chains; use `try/catch` with `await` for error handling.
10. **`console.log` is never production-ready** — use a structured logger; no `console.log` in committed code outside tests.

## Anti-patterns

- `as any` or `as unknown as T` to silence type errors — fix the type instead.
- `!` non-null assertion without proof — prove non-null or use `?.` / `?? defaultValue`.
- `enum` when a string literal union (`type Status = 'active' | 'closed'`) suffices.
- Mutating function arguments — return new values; callers should not observe side effects on inputs.
- `catch (e) { }` swallowing errors silently — always log or rethrow.
- Nesting `Promise.then` chains instead of using `async/await`.
- Exporting mutable state — prefer immutable data shapes and pure transformation functions.
