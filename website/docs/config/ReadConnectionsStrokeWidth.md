---
id: readconnectionsstrokewidth
title: ReadConnectionsStrokeWidth
description: "The read connections' encoding.strokeWidth, the width each arc or line strokes at."
sidebar_label: Display setting -> ReadConnectionsStrokeWidth
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/readConnectionsStrokeWidthConfigSchema.ts).

The read connections' `encoding.strokeWidth`, the width each arc or line
strokes at. By default each connection's `reads`, the reads that agree on
it, run through a log scale from 1 px at one read to 4 px at 44 or more,
so each doubling adds the same width. A number is the constant every
connection takes, whatever its reads, and is written to `value`.

## Example usage

```js
{
  type: 'LinearAlignmentsDisplay',
  readConnections: { show: true, encoding: { strokeWidth: 2 } },
}
```

```js
{
  type: 'LinearAlignmentsDisplay',
  readConnections: {
    show: true,
    encoding: { strokeWidth: { field: 'reads', scale: { range: [1, 8] } } },
  },
}
```

## Config slots

A setting written to it replaces it whole: a member left out returns to its default. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-value">**value**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | The px every connection strokes at while no field is written; the Line width menu writes it. Unset, `reads` maps through the scale. |
| <span id="slot-field">**field**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (reads) | `reads`, the reads that agree on a connection, the one count a width reads; a written field maps through `scale` over any `value`. |
| <span id="slot-scale">**scale**</span><br>[ReadConnectionsStrokeWidthScale sub-schema](#slot-scaletype) | How `reads` map to a width: from one read to 44, past which more reads add no width. |
| <span id="slot-scaletype">**scale.type**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (log, linear) = <code>'log'</code> | log adds the same width per doubling of reads; linear the same per read |
| <span id="slot-scalerange">**scale.range**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | The px at one read and at 44, thinnest first. Empty is 1 to 4. |
