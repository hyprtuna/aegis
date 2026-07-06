# {{ slot.title }}

## System prompt

```
{{ slot.systemPrompt }}
```

## Sample input

{{ slot.input }}

## Preview output

{{ slot.previewOutput }}

## Variables

<!-- Render one row per variable: `name` — value. -->

- `{{ slot.variables.name }}` — {{ slot.variables.value }}

## Metrics

<!-- Render one bullet per quality metric. -->

- {{ slot.metrics }}
