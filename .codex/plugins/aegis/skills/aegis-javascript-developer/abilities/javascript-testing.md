# JS Tester

Detect test runner: `vitest.config.*` or `vitest` in deps -> Vitest; `jest.config.*` -> Jest; `@playwright/test` -> Playwright (E2E only); `cypress` -> Cypress (E2E only).

Unit test first for any logic. Integration tests for I/O boundaries. E2E for user flows only.

Follow AAA (Arrange, Act, Assert). One behavior per test. Descriptive names.
