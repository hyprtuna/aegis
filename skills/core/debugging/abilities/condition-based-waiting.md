# Condition-Based Waiting

On-demand reference for replacing arbitrary `sleep()` waits with condition polling. Parent `SKILL.md` covers the debugging methodology.

Never use arbitrary `sleep()` or `setTimeout()` to wait for async operations to complete. Arbitrary waits are fragile: too short fails on slow machines, too long wastes time. Both hide the real problem.

## The Problem With Arbitrary Waits

```typescript
// BAD — arbitrary sleep
await new Promise(resolve => setTimeout(resolve, 5000))
const result = await db.query('SELECT * FROM jobs WHERE id = ?', [jobId])
expect(result.status).toBe('complete')
```

This test passes on your machine (job finishes in 2s) and fails in CI (job takes 6s under load). The 5000ms is a guess, not a condition. When it fails, the failure message tells you nothing useful.

## The Condition-Based Pattern

Replace the arbitrary wait with a function that polls for a condition, retries on a configurable interval, and times out with a useful error:

```typescript
// GOOD — poll for condition
async function waitFor<T>(
  condition: () => Promise<T | null | undefined | false>,
  options: { timeout?: number; interval?: number; label?: string } = {}
): Promise<T> {
  const { timeout = 10_000, interval = 100, label = 'condition' } = options
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const result = await condition()
    if (result) return result
    await new Promise(resolve => setTimeout(resolve, interval))
  }
  throw new Error(`waitFor: timed out after ${timeout}ms waiting for ${label}`)
}

// Usage in test
const result = await waitFor(
  () => db.query('SELECT * FROM jobs WHERE id = ? AND status = ?', [jobId, 'complete']),
  { timeout: 15_000, interval: 200, label: `job ${jobId} completion` }
)
expect(result.status).toBe('complete')
```

When the timeout fires, you get: `waitFor: timed out after 15000ms waiting for job 42 completion` — a message that tells you exactly what did not happen and how long you waited.

## Where to Use Condition-Based Waiting

- **Tests:** Any test that waits for an async side effect (queue message processed, file written, job completed, cache invalidated).
- **CI scripts:** Health-check loops waiting for a service to become ready.
- **Application code:** Polling for external state that changes asynchronously (payment webhook received, deployment finished, peer sync completed).

## Adjusting the Parameters

| Scenario | timeout | interval |
|---|---|---|
| Unit test, fast in-process op | 2 000ms | 50ms |
| Integration test, local DB/queue | 10 000ms | 100ms |
| E2E test, full pipeline | 60 000ms | 500ms |
| CI service ready check | 120 000ms | 1 000ms |

Set `timeout` to the maximum time the operation should ever take under worst-case conditions. Set `interval` to the minimum polling granularity you need. Do not set `interval` lower than 50ms — you will burn CPU for no gain.
