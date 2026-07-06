#!/usr/bin/env node
// validate-structure.mjs — thin entry. Real logic lives in scripts/validate/.
//
// The orchestrator (scripts/validate/index.mjs) builds one shared context, runs
// each rule module in section order, enforces the 30s ceiling, prints warnings
// then errors, and exits non-zero on errors.
//
// HARD CEILING: 30 seconds. If validation exceeds this, the tooling is broken.

import "./validate/index.mjs";
