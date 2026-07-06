# Fowler code-smell baseline

> **Framing:** these are judgement-call heuristics, not hard rules. Each smell is a prompt for
> scrutiny during the code-quality pass, not an automatic finding. Repo and project standards
> (CLAUDE.md, lint config, `.editorconfig`, documented team conventions) always override this
> baseline — if a convention explicitly sanctions a pattern below, that convention wins.

Fowler's 12 classic "bad smells," as a compact checklist:

- **Long method** — a function doing too much to hold in one read.
- **Large class** — a class or module accumulating unrelated responsibilities.
- **Duplicated code** — the same logic copy-pasted across sites instead of shared.
- **Feature envy** — a method more interested in another object's data than its own.
- **Primitive obsession** — raw strings/numbers standing in for a missing domain type.
- **Shotgun surgery** — one conceptual change forces edits across many unrelated files.
- **Divergent change** — one class changes for many unrelated reasons.
- **Data clumps** — the same group of fields or parameters traveling together everywhere.
- **Long parameter list** — a signature carrying too many positional arguments.
- **Message chains** — `a.b().c().d()` coupling the caller to internal structure it shouldn't know.
- **Speculative generality** — abstraction built for a future need that hasn't arrived.
- **Comments as deodorant** — a comment explaining code that should instead be rewritten to be clear.

Use this list to decide where to look harder, not what to flag automatically. A hit is a
candidate for scrutiny, not a finding on its own — confirm it against the confidence bar and
false-positive filters before reporting.
