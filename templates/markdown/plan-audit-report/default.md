## Plan Verification Report

**Plan:** {{ slot.planName }}  **Goal:** {{ slot.goal }}  **Verdict:** {{ slot.verdict }}

### Coverage

<!-- One row per requirement: "✓" if mapped to a covering task, "✗ NOT COVERED" otherwise. -->

- {{ slot.coverage.requirement }} -> {{ slot.coverage.status }}

### Gaps

<!-- One numbered entry per gap: what is missing and why it matters. -->

1. {{ slot.gap }}

### Extras

<!-- One numbered entry per task not justified by any requirement. -->

1. {{ slot.extra }}

### File References

<!-- One row per referenced path: "EXISTS ✓" or "MISSING ✗". -->

- {{ slot.fileReference.path }} -> {{ slot.fileReference.status }}

### Ordering Issues

<!-- One row per ordering violation. -->

- {{ slot.orderingIssue }}

### Task Quality

<!-- One row per task-quality problem. -->

- {{ slot.taskQuality }}

**Tasks with complete fields:** {{ slot.tasksComplete }}

### Verdict Rationale

{{ slot.verdictRationale }}
