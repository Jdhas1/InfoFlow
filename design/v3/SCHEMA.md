# flow-map.json — the data contract

The atlas reads one file: `flow-map.json`, sitting next to the HTML. The arrays
inside the page are only a built-in demo; if this file loads, it replaces them
entirely. Your mapping tool needs to emit this shape — nothing else changes.

```json
{
  "version": 1,
  "name": "Dave's Map — mixed office & shop-floor process",

  "steps": [
    { "id": "s1", "order": 0, "label": "Quote" }
  ],

  "methods": [
    { "id": "key", "label": "Typed in by hand", "manual": true,
      "speed": 0.17, "style": "dashed", "risk": 2.2 }
  ],

  "containers": [
    { "id": "c5", "name": "Job Log", "step": "s3",
      "owner": "Customer Care", "system": "Excel", "category": "Commercial" }
  ],

  "information": [
    { "id": "i8", "name": "Job Number", "category": "Commercial" }
  ],

  "transfers": [
    { "information": "i8", "from": "c5", "to": "c6", "method": "auto" }
  ]
}
```

## Field by field

**steps** — the process spine. `order` drives the left-to-right columns in the
Process step and Follow-one-field arrangements. `label` is what's printed.

**methods** — *how* information moves. This is the only place risk is defined,
and everything visual derives from it:

| key | effect |
| --- | --- |
| `style` | `solid` = automatic (steel), `dashed` = re-keyed (pale steel), `dotted` = verbal (rust) |
| `speed` | how fast particles travel the line — 0.1 crawls, 0.6 races |
| `risk` | weight added to both endpoints; drives node colour, the risk bands, and the "Most at risk" list |
| `manual` | reserved — currently informational |

You can rename, add or remove methods freely; the six shipped ids (`gen`,
`auto`, `recv`, `scan`, `key`, `verbal`) are just a sensible default set.

**containers** — where information lives. `step` references a `steps[].id`.
`owner` drives the Role/owner arrangement and the department filters; `system`
drives System of record; `category` drives Information type. Node size is
computed from traffic, not supplied.

**transfers** — the actual edges: one row per *field* moving between two
containers by one method. This is the atom of the whole model; a container-to-
container line on screen is every transfer between that pair, aggregated.

## What is derived, not supplied

Don't try to send these — they're computed, and supplying them would let the
picture drift from the data:

- risk score and band for every container and field (sum of method risk)
- how many containers keep a field, and how many hops it makes
- a field's dominant owner / system / step (the mode of its containers)
- which fields travel together (co-occurrence in the same transfer)
- node sizes, edge weights, crossing-minimised column order, camera framing

## Minimum viable export

`steps`, `containers`, `information`, `transfers`. Omit `methods` and the six
defaults apply. Omit `steps` and everything collapses to one column — the
Process step and Follow-one-field views stop being useful, so include it.

## Ids

Any stable strings. They're used as references only; the page never parses them.
Keep them stable across exports and the user's dragged node positions and pins
stay meaningful between sessions.
