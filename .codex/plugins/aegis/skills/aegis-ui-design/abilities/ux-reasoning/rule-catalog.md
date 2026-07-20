# UX Reasoning Rule Catalog (25 rules)

The full rule catalog. Each rule: title, rationale, concrete example, common violation. Parent `SKILL.md` is the index and decision flow.

## Section 1 · Perception & cognition

### 1. Fitts's Law
**Rule:** Time to acquire a target grows with distance and shrinks with target size. Place primary CTAs large and close to where the user's attention already is.
**Example:** Sticky mobile CTA at thumb height, ≥ 44×44pt tap target. "Continue" at the bottom of a form, not in the header.
**Violation:** Primary action in a top corner of a modal, 200px away from the content the user just read.

### 2. Hick's Law
**Rule:** Decision time grows with the log of the number of choices. When options exceed 7, group, filter, or paginate.
**Example:** A settings page with 30 options must have sections and search. A navigation with 12 top-level items must collapse secondary items behind a "More" affordance.
**Violation:** A flat unsorted dropdown of 40 country codes.

### 3. Miller's Number
**Rule:** Working memory holds ~7 ± 2 chunks. Do not force the user to carry more than ~5 items across steps.
**Example:** A 5-step checkout is better than one 20-field page if each step is self-contained and doesn't require memorising decisions from earlier.
**Violation:** A multi-step form where step 4 asks "confirm the email you entered in step 1" — that email has scrolled off screen.

### 4. Recognition over recall
**Rule:** Show options; do not make the user remember them. Visible affordances outperform hidden commands.
**Example:** Recent files list at the top of a file picker. Command palette with a history of recently used commands.
**Violation:** A command-line-only interface in a product targeting non-technical users.

### 5. Progressive disclosure
**Rule:** Reveal advanced options only when needed. Default to the simplest path.
**Example:** One-click "Advanced" expander in a settings row. "More options" link in a search form.
**Violation:** Showing API rate limits, webhook configuration, and audit logs to a user who just signed up.

### 6. Visual hierarchy: size > weight > colour > position
**Rule:** Size outranks weight; weight outranks colour; colour outranks position. Establish hierarchy in this order — don't compensate for a size problem with a colour workaround.
**Example:** Don't bold a 24px heading — the size already carries it. Reserve bold for body-size emphasis.
**Violation:** Same-size text differentiated only by colour (fails colour-blind users AND perceived hierarchy).

### 7. Proximity law
**Rule:** Elements placed close together are perceived as related. Use proximity intentionally to group; use whitespace to separate.
**Example:** Form label directly above its input (4–8px gap) signals ownership. A 24px gap between label and input suggests they might not be related.
**Violation:** A radio button group where options are 32px apart — they read as separate items, not a group.

## Section 2 · State design

### 8. Every interactive component needs four states minimum
**Required:** idle, hover (desktop), focus, disabled.
**Interactive add:** pressed / active, loading, error.
**Rule:** Drop one state and the component feels broken or inaccessible.
**Example:** A button with idle + hover but no focus state fails keyboard navigation users.
**Violation:** Disabled state that looks identical to idle — user doesn't know if the button will work.

### 9. Empty states teach the product
**Rule:** An empty state is a tutorial moment, not a whitespace problem. Show the user what belongs here and how to put something there.
**Example:** "No files yet — drop one here or paste a URL" with a visible drop zone and an upload button.
**Violation:** Blank white space with a generic "No data" label and no action.

### 10. Loading states
**Rule:** Match the loading state to the time range and the final layout.
- < 0.1 s: no indicator.
- 0.1–1 s: subtle spinner or animation.
- 1–10 s: skeleton screen matching the final layout.
- > 10 s: determinate progress (%) + ability to do something else.
**Violation:** A centred spinner for a 3-second page load where the final layout is a 4-card grid.

### 11. Error states: specific, recoverable, not blamey
**Rule:** Every error must answer: what went wrong, how to fix it, and where to act.
**Example:** "Couldn't connect — check your Wi-Fi and try again" + inline Retry button beats "Network error 503".
**Violation:** "An error occurred. Please try again." No context, no recovery action, user has to find their way back.

### 12. Skeleton screens beat spinners
**Rule:** For layouts you know in advance, render a greyscale skeleton sized to match the final content. Reduces perceived wait time.
**Example:** A list of 5 cards renders as 5 grey rounded rectangles of the correct height before data arrives.
**Violation:** Centred spinner on a full-page layout, then jarring reflow when content loads.

### 13. Destructive actions require friction
**Rule:** Irreversible operations (delete, revoke, override) require confirmation at minimum. Bulk destructive actions require typing a name or phrase.
**Example:** Archive: inline undo snackbar for 5s. Permanent delete: "Type `delete-project` to confirm." Revoking production API key: modal with name confirmation.
**Violation:** Delete button without confirmation, adjacent to the Edit button.

### 14. Undo beats confirm (where feasible)
**Rule:** Where the action is reversible server-side, show a 5–10 s "Undo" snackbar instead of a confirm dialog. Reduces friction, reduces error rate.
**Example:** "Archived — Undo" snackbar for an email archive action.
**Violation:** A confirm dialog for every single-item archive in a batch-work tool — forces N confirmation clicks for N items.

## Section 3 · Interaction & input

### 15. Default to the most common answer
**Rule:** Pre-fill or pre-select the answer that ≥ 70% of users will choose. Don't start with a blank field when a sensible default exists.
**Example:** Country field defaults to the user's inferred locale. "Send receipt" checked by default in a paid checkout flow.
**Violation:** Date picker with no default date — user must navigate from an empty state.

### 16. Sort by usefulness, not alphabet
**Rule:** Alphabetical sort is rarely the most useful order. Sort by frequency, recency, or relevance.
**Example:** Country dropdown: inferred country + top 5 markets first, then alphabetical. Emoji picker: most used first.
**Violation:** A "Select language" dropdown opening at Afrikaans because it's alphabetically first.

### 17. Touch targets ≥ 44×44 pt
**Rule:** Minimum for any interactive element on touch interfaces. On desktop, ≥ 32×32px with a hover hit-area enlargement.
**Example:** A close button with a 16×16 icon but a 44×44 invisible hit area around it.
**Violation:** 20×20px icon-only button in a dense mobile toolbar.

### 18. Focus ring: visible and branded
**Rule:** `:focus-visible` must have a ring. Preferably the brand accent at ≥ 3:1 contrast against the element background. Never remove outline without a replacement.
**Example:** 2px solid `--color-primary`, 2px offset. The ring is part of the brand, not an unwanted browser default.
**Violation:** `outline: none` in a global reset with no replacement — keyboard users have no visible focus indicator.

### 19. Tab order follows visual reading order
**Rule:** Tab navigation must match the visual left-to-right, top-to-bottom reading order. No surprise jumps.
**Example:** Two-column form: tab goes down the left column, then the right — not left → right → left → right.
**Violation:** A modal where Tab after the last input jumps to the page background instead of trapping inside the modal.

### 20. Keyboard-first navigation
**Rule:** Every interactive element reachable via keyboard. Modals trap focus. Escape closes modals and menus. Arrow keys navigate lists and menus.
**Example:** Command palette opens with ⌘K, first input is auto-focused, Tab cycles results, Escape closes, Enter selects.
**Violation:** A custom dropdown that requires mouse click — Tab focuses the trigger but arrow keys do nothing.

## Section 4 · Motion & feedback

### 21. Feedback within 100 ms
**Rule:** Any user action (hover, press, click) must produce a visible response within 100 ms or the interface feels unresponsive. Apply pressed state immediately, even if the underlying action is async.
**Example:** Button changes to a pressed / loading state at the moment of click, not 400 ms later when the API responds.
**Violation:** A button that looks identical before and after click until the network response arrives.

### 22. Motion respects `prefers-reduced-motion`
**Rule:** Disable or shorten animations when the media query fires. This is accessibility, not a nice-to-have.
**Example:**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```
**Violation:** Full-page scroll animations with no reduced-motion fallback.

### 23. Easing communicates material
**Rule:** Easing signals the "physics" of the interface. Bouncy for playful, linear for mechanical, `cubic-bezier(.2, .6, .2, 1)` for natural UI. Don't mix easing conventions across the same product.
**Example:** All modal enter/exit transitions use the same `ease-out` curve. Card hover uses the same curve at a shorter duration.
**Violation:** Modal enters with `ease-in-out`, tooltip enters with `spring`, dropdown with `linear` — three physics models in one product.

## Section 5 · Content & composition

### 24. One primary CTA per view
**Rule:** Each view has one most-important action. Secondary actions are visually subordinate — ghost, link, or lower-contrast button style.
**Example:** "Sign up" = primary filled button. "Sign in" = ghost or text link underneath — same visual area, clearly subordinate.
**Violation:** Two filled primary-colour buttons of equal size competing for attention ("Save draft" + "Publish now" — identical weight).

### 25. Copy is UI
**Rule:** Button text, empty states, errors, confirmations, and tooltips are design decisions. Tone, length, and specificity shape the product's character.
- Verbs on buttons, not nouns: "Create project" beats "Submit".
- Specific over generic: "Saved — 2 min ago" beats "Save successful".
- First-person user voice in settings: "I want email reminders" beats "Enable email reminders".
- Apology-free error messages: explain and help, don't apologise.
**Violation:** "Submit" button (what does it submit?), "Error occurred" (which error? what now?), "Settings updated" confirmation that doesn't say what changed.
