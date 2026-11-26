# flow-map.json — the data contract

The Atlas reads one data object in this shape. Map Intake builds it from the captured map
(`atlasData()` in `src/atlas/convert.ts`) every time you open the Map view. A standalone Atlas page
could read the same shape from a `flow-map.json` file next to it (not shipped in beta 1).

> **Updated for beta 1 (26 Nov 2026).** This file now describes what Map Intake actually sends.
> Compared with the earlier version of this document:
> 1. Containers carry five more fields: `unused`, `preexisting`, `origin`, `parent`, `fields`, and
>    sometimes `memory`.
> 2. There is a top-level `checks` list.
> 3. Intake's method ids are `typed`, `paste`, `written`, `scan`, `auto`, `calculate`, `decide`,
>    `measure`, `update`, `verbal` and `unknown` (not the Atlas demo's `gen`, `recv`, `key`).
> 4. **New:** "Tell verbally" actions now produce `verbal` transfers into a person's head (see
>    "Spoken information" below). Before beta 1 they produced no line at all.
>
> All additions are optional for a reader: an Atlas that ignores them still works.

```json
{
  "version": 1,
  "name": "Dave's shop: order to floor",

  "steps": [
    { "id": "s1", "order": 0, "label": "Open job" },
    { "id": "__unused", "order": 7, "label": "Not used in any step yet" }
  ],

  "methods": [
    { "id": "typed", "label": "Typed by hand", "style": "dashed", "risk": 2.2, "speed": 0.17 }
  ],

  "containers": [
    { "id": "c1", "name": "Job Log row", "step": "s1",
      "owner": "Customer Care Coordinator", "system": "Spreadsheet", "category": "Spreadsheet",
      "unused": false, "preexisting": false, "origin": null, "parent": null,
      "fields": ["i5", "i0"] }
  ],

  "information": [
    { "id": "i5", "name": "Job Number", "category": "Information" }
  ],

  "transfers": [
    { "information": "i5", "from": "c1", "to": "c2", "method": "typed" }
  ],

  "checks": [
    { "step": "s5", "information": ["i3"], "against": ["c7"], "resultTo": [],
      "resultToWho": null, "onFail": null }
  ]
}
```

## Field by field

**version**: always `1` for this shape.

**name**: the map's title, printed in the Atlas header.

**steps**: the process spine. `order` drives the left-to-right columns in the Process step and
Follow-one-field arrangements. `label` is what's printed. Intake adds a last step with id
`__unused` ("Not used in any step yet") only when some container isn't touched by any action.

**methods**: *how* information moves. This is the only place risk is defined, and everything
visual derives from it:

| key | effect |
| --- | --- |
| `style` | `solid` = automatic (steel), `dashed` = re-keyed (pale steel), `dotted` = verbal or not recorded (rust) |
| `speed` | how fast particles travel the line: 0.1 crawls, 0.6 races |
| `risk` | weight added to both endpoints; drives node colour, the risk bands, and the "Most at risk" list |
| `manual` | optional, reserved, currently informational |

Methods Intake sends:

| id | label | style | risk | speed | comes from |
| --- | --- | --- | --- | --- | --- |
| `typed` | Typed by hand | dashed | 2.2 | 0.17 | Copy, typed |
| `paste` | Copy & paste | dashed | 1.8 | 0.22 | Copy, pasted |
| `written` | Hand-written | dashed | 2.0 | 0.18 | Copy, hand-written |
| `scan` | Scanned / imported | dashed | 1.5 | 0.24 | Copy, scanned |
| `auto` | Automatically | solid | 0.2 | 0.58 | Copy, automatic |
| `calculate` | Calculated | solid | 0.6 | 0.45 | Calculate |
| `decide` | Decided | solid | 0.8 | 0.4 | Decide |
| `measure` | Measured | solid | 0.5 | 0.45 | Measure |
| `update` | Updated | dashed | 1.2 | 0.3 | Update |
| `verbal` | Told verbally | dotted | 3.4 | 0.1 | Tell (new in beta 1) |
| `unknown` | Method not recorded | dotted | 3.0 | 0.1 | Copy with no method chosen |

A reader can rename, add or remove methods freely; the Atlas demo's six ids (`gen`, `auto`,
`recv`, `scan`, `key`, `verbal`) are its defaults when `methods` is omitted.

**containers**: where information lives.

| field | meaning |
| --- | --- |
| `id`, `name` | as captured |
| `step` | a `steps[].id`: the first step (in process order) where any action touches it, or `__unused` |
| `owner` | the container's owner; if none was recorded, whoever most often fills, receives or files it; else `"No owner recorded"`. Drives the Role/owner arrangement and the department filters |
| `system` | the format (e.g. "Spreadsheet"), or `"Format not set"`, plus `" · existing source"` when pre-existing. Drives System of record |
| `category` | same as `system`. Drives Information type |
| `unused` | `true` when no action touches it at any step |
| `preexisting` | `true` when it exists before this process starts |
| `origin` | for pre-existing containers: where it comes from (free text), else `null` |
| `parent` | id of the container it sits inside, else `null` |
| `fields` | information ids it is meant to hold |
| `memory` | only present (`true`) on the "head" nodes described below |

Node size is computed from traffic, not supplied.

**information**: `id`, `name`, and `category` (always `"Information"` from Intake for now).

**transfers**: the actual edges: one row per *field* moving between two containers by one method.
This is the atom of the whole model; a container-to-container line on screen is every transfer
between that pair, aggregated. Intake writes one transfer for every combination of an action's
information, its *from* containers and its *to* containers, for the verbs that write information
(create, copy, decide, measure, calculate, update) and that have both a *from* and a *to*.
Read-only actions (read, check) and whole-container actions (receive, send, file, print, archive,
set up) do not draw lines.

**checks**: one row per Check action: its `step`, the `information` checked, the containers looked
at (`against`), where the result was written (`resultTo`), who was told the result
(`resultToWho`, a performer id), and what happens if it fails (`onFail`, free text).

## Spoken information (new in beta 1)

"Tell verbally" actions produce `verbal` transfers so word-of-mouth handoffs show as rust dotted
lines. Because a transfer needs two containers, Intake adds one **head node** per person:

- id `__head_<performer id>`, name `"<Name> (in their head)"`, `system` and `category`
  `"In someone's head"`, `owner` the person, `memory: true`, `fields` the information they were
  told, and `step` the first step where they were told something.
- A Tell from containers draws `container → listener's head`. A Tell with no container draws
  `speaker's head → listener's head`.
- When the listener (or the speaker) wasn't recorded, the node is `__head_unknown`,
  "Someone (not recorded)".

## What is derived, not supplied

Don't try to send these: they're computed, and supplying them would let the picture drift from
the data:

- risk score and band for every container and field (sum of method risk)
- how many containers keep a field, and how many hops it makes
- a field's dominant owner / system / step (the mode of its containers)
- which fields travel together (co-occurrence in the same transfer)
- node sizes, edge weights, crossing-minimised column order, camera framing

## Minimum viable data

`steps`, `containers`, `information`, `transfers`. Omit `methods` and the Atlas defaults apply.
Omit `steps` and everything collapses to one column; the Process step and Follow-one-field views
stop being useful, so include it.

## Ids

Any stable strings. They're used as references only; the page never parses them. Keep them stable
across exports and the user's dragged node positions and pins stay meaningful between sessions.
Ids starting with `__` are reserved for nodes Intake makes up (`__unused`, `__head_…`).
