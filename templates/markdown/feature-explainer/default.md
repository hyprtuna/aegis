# {{ slot.topic }}

> **Overview** — {{ slot.overview }}

<!-- Render one block per section (heading + body). -->

## {{ slot.section.heading }}

{{ slot.section.body }}

## Code

<!-- Render one labeled code block per snippet. -->

`{{ slot.code.caption }}`

```
{{ slot.code.body }}
```
