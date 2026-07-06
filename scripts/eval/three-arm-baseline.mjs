#!/usr/bin/env node
// three-arm-baseline.mjs — SKELETON ONLY (v0.0.6). No API calls, no network,
// no cost. This is a placeholder that reserves the path for the deferred
// three-tier eval framework. See scripts/eval/README.md for the full plan.
//
// The eventual framework runs three arms over the fixtures in ./fixtures/:
//   1. Static lint     — deterministic, dependency-free checks (no model).
//   2. LLM Judge       — a model scores outputs against a rubric (needs API key).
//   3. Monte Carlo     — repeated sampled runs to measure variance/regression.
//
// Arms 2 and 3 require API key handling, a CI cost budget, and result storage —
// all deferred to v0.1.x+ per .aegis/plans/v0.0.6-plan.md "Honest Gaps". This
// runner intentionally does nothing but print a marker line and exit 0.

console.log("eval harness skeleton — no API calls in v0.0.6");
process.exit(0);
