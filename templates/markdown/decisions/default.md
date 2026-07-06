**Each decision must contain four parts** — anything thinner is a placeholder, not a decision:

1. **The question** — what specifically needs deciding, framed as a one-line statement of the choice. Avoid vague nouns ("storage approach"); name the concrete decision ("where to store SDD artifacts").
2. **The options** — at least two, each with a short explanation (≤ 2 lines). One-line option names without the tradeoff are not enough; the explanation tells the reader *what they give up* by picking one over another.
3. **The recommendation** — exactly one option, named explicitly. Equivocation (`A or B both reasonable`) defers the decision to the implementer; that's an Open Question, not a decision.
4. **The reason** — why this option wins given the constraints in this spec. Reference the codebase scan, prior plans, or risk profile. "Simpler" alone is not a reason.

**Decision ID convention (mandatory):** every decision MUST be tagged with a zero-padded
two-digit ID using the format `D-NN:` — `D-01:`, `D-02:`, `D-03:`, and so on. IDs may
extend beyond two digits (`D-10:`, `D-11:`, …) but must never use fewer than two digits.

**Decision template (use this shape verbatim in the spec's `<decisions>` block):**

```
D-NN: <One-line question — what needs to be decided>

Options:
  A) <Option name> — <≤2-line explanation; what you give up vs the others>
  B) <Option name> — <≤2-line explanation>
  C) <Option name> — <≤2-line explanation>     # add as needed; A/B minimum

Recommendation: <A | B | C>
Reason: <why this option wins given THIS spec's constraints; cite scan,
         prior plan, or risk profile. 1-3 lines.>
```

**Worked example:**

```
D-01: Where SDD artifacts (spec.md, plan.md, tasks.md) live on disk

Options:
  A) .aegis/specs/features/<slug>/ — versioned, git-tracked, picked up by
                                     PR review; matches the .aegis/{plans,specs}/
                                     convention.
  B) .aegis/features/<slug>/     — gitignored; transient state only;
                                   artifacts disappear from PR diffs
                                   and code-archaeology.
  C) <slug>/aegis/               — colocated with feature code; clear
                                   locality but scatters spec/plan
                                   discovery across the repo tree.

Recommendation: A
Reason: Per-feature directory groups the SDD trio so PR review captures
        spec+plan+tasks in one diff. (B) was the original draft; rejected
        because gitignored artifacts can't be reviewed.
```

## Decision tri-partition (Locked / Deferred / Discretionary)

Group the decisions into three explicit buckets so a reader (and any downstream
plan or implementer) knows which choices are settled, which are punted, and which
are left to the implementer's judgment. Every `D-NN` decision belongs to exactly
one bucket.

- **Locked** — decided now and binding. The recommendation is chosen; the
  implementer MUST follow it. Changing a Locked decision requires re-opening the
  spec and re-approval.
- **Deferred** — deliberately not decided yet. State *why* it is deferred and the
  *trigger* that will force the decision (a later phase, a benchmark result, a
  user answer). A Deferred item is effectively an Open Question with a known
  decision shape — do not silently drop it.
- **Discretionary** — the implementer may choose freely within stated bounds. Name
  the acceptable range and the constraint that bounds it; any choice inside the
  bound is acceptable without re-approval.

Render the buckets as three labeled subsections; each lists the relevant `D-NN`
IDs (a decision may be a one-liner under Deferred/Discretionary if its full
four-part shape lives above):

```
### Locked
- D-01: <one-line restatement> — binding; follow as recommended.
- D-03: <one-line restatement> — binding.

### Deferred
- D-04: <question> — deferred until <trigger>; <why not now>.

### Discretionary
- D-05: <area> — implementer's choice within <stated bound>.
```

An empty bucket is written explicitly as `- (none)`, never omitted — the absence
is itself information.
