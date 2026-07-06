# {{ slot.title }}

> **Question** — {{ slot.question }}

## Call sequence

<!-- Render one numbered block per step. -->

### {{ slot.callSequence.location }}

{{ slot.callSequence.description }}

```
{{ slot.callSequence.code }}
```

## Components

<!-- One row per component. -->

- `{{ slot.component.path }}` — {{ slot.component.role }}

## References

<!-- One bullet per related file. -->

- {{ slot.references }}
