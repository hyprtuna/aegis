# Root-Cause Tracing

On-demand reference for backward-trace investigation. Parent `SKILL.md` covers the 4-phase methodology, the iron law, and the debugging checklist.

The crash site is never the origin. The crash site is where the damage surfaces. Your job is to trace backward from the crash to the point where bad data entered the system.

## The Backward Trace Protocol

1. **Start at the crash site.** Identify the bad value. What variable is null, wrong, or missing? What invariant was violated?
2. **Trace one step back.** Where did that value come from? What set it? What returned it?
3. **Inspect that value at that earlier point.** Is it already wrong there?
4. **Repeat until you reach the origin.** The origin is the first place in the execution where the value is wrong. Everything upstream of the origin is fine.

Do not stop at the first point you can add a null check. Keep tracing.

## Example: Route Parameter Mismatch

```
Error: Cannot read properties of undefined (reading 'name')
  at UserProfile.render (UserProfile.tsx:42)
```

**Crash site:** `user.name` is undefined inside `UserProfile.render`.

**Step back 1:** Where does `user` come from? Passed as a prop from `UserPage`.

```tsx
// UserPage.tsx
const user = useSelector(state => state.users[userId])
return <UserProfile user={user} />
```

**Step back 2:** Is `state.users[userId]` wrong? Log it.
Result: `userId` is `"undefined"` (the string), not an actual ID.

**Step back 3:** Where does `userId` come from?

```tsx
const { userId } = useParams()
```

**Step back 4:** What does the route look like?

```tsx
// Route definition
<Route path="/users/:user_id" element={<UserPage />} />
// But the component reads: useParams().userId (not user_id)
```

**Origin found.** The route uses `:user_id` but the component reads `userId`. The parameter name mismatch means `useParams()` returns `{ user_id: "123" }` while the component destructures `userId`, getting `undefined`.

**Fix:** Change the route to `:userId` OR change the destructure to `user_id`. Fix at the origin, not at the crash site.

## What NOT to Do

```tsx
// BAD — symptom suppression
if (!user) return null  // Hides the problem, does not fix it

// BAD — default masking
const user = useSelector(state => state.users[userId]) ?? {}
// Now user.name is still undefined but the error is gone. Data is silently wrong.
```

Both patterns suppress the crash without understanding why `user` is undefined. The actual bug — the route/param name mismatch — is still there and will cause silent data errors in production.

The rule: **never add a null check at the crash site without tracing backward first.** A null check at the crash site is only valid once you have traced to the origin and determined that null is a legitimate expected value at that point.
