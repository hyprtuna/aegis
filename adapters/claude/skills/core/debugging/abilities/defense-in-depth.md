# Defense in Depth

On-demand reference for validation at multiple layers. Parent `SKILL.md` covers the 4-phase debugging methodology.

After you find and fix the root cause, add validation at multiple layers. A single validation point at the input boundary is not enough. Real systems have many entry points and many ways to violate assumptions.

## The Three Validation Layers

**Input boundary:** Validate external data immediately when it enters the system.
- HTTP request body, query params, headers
- File reads, environment variables, config files
- External API responses, database rows

**Domain boundary:** Validate data when it crosses between internal modules.
- Service function arguments
- Data transformation results
- State transitions

**Output boundary:** Validate data before it leaves the system.
- Response serialization
- Data written to disk, DB, or external service
- Values passed to external APIs

Each layer validates independently. Do not assume a downstream layer has already validated. Do not assume an upstream layer has already validated.

## Example: Empty String Propagating Through 4 Layers

The bug: a payment is processed with an empty `customerId`, which creates a corrupt transaction in the external payment processor.

**Without defense in depth:**

```typescript
// Layer 1 — HTTP handler (no validation)
app.post('/pay', async (req, res) => {
  const result = await paymentService.charge(req.body.customerId, req.body.amount)
  res.json(result)
})

// Layer 2 — Service (no validation)
async function charge(customerId: string, amount: number) {
  const customer = await db.customers.findById(customerId)
  return await stripeClient.charge(customer.stripeId, amount)
}

// Layer 3 — DB query (no validation, returns null for empty string)
// Layer 4 — Stripe call (accepts empty stripeId, creates corrupt record)
```

Empty string flows all the way to Stripe before anything breaks — and by then a corrupt record exists.

**With validation at multiple layers:**

```typescript
import { z } from 'zod'

// Layer 1 — Input boundary: validate at HTTP handler
const ChargeRequestSchema = z.object({
  customerId: z.string().min(1, 'customerId is required'),
  amount: z.number().positive('amount must be positive'),
})

app.post('/pay', async (req, res) => {
  const parsed = ChargeRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }
  const result = await paymentService.charge(parsed.data.customerId, parsed.data.amount)
  res.json(result)
})

// Layer 2 — Domain boundary: validate at service entry
async function charge(customerId: string, amount: number) {
  if (!customerId) throw new Error('charge: customerId must not be empty')
  if (amount <= 0) throw new Error('charge: amount must be positive')
  const customer = await db.customers.findById(customerId)
  if (!customer) throw new Error(`charge: customer not found: ${customerId}`)
  return await stripeClient.charge(customer.stripeId, amount)
}

// Layer 3 — Output boundary: validate before external call
async function stripeCharge(stripeId: string, amount: number) {
  if (!stripeId) throw new Error('stripeCharge: stripeId must not be empty')
  return await stripe.charges.create({ customer: stripeId, amount })
}
```

Now the empty string is caught at Layer 1 and never reaches Layer 2, 3, or 4. If somehow an invalid value bypasses Layer 1, Layer 2 catches it. Each layer is a independent defense. No layer trusts the others.

## When Validation Overlaps

Validation at multiple layers WILL produce some redundancy. That is intentional. The redundancy is cheap (a few microseconds). Silent data corruption is expensive. Prefer redundant validation over trusting that "someone else already checked this."
