# {{ slot.title }}

{{ slot.lead }}

## Diagram

```mermaid
flowchart TD
{{ slot.nodes }}
{{ slot.edges }}
```

## ASCII fallback

```
{{ slot.ascii }}
```

## Nodes

{{ slot.nodeList }}

## Edges

{{ slot.edgeList }}
