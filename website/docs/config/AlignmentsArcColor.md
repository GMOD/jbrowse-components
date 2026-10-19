---
id: alignmentsarccolor
title: AlignmentsArcColor
description: "The alignments displays' readConnections.color setting colors the read-connection arcs and the read cloud."
sidebar_label: Display -> AlignmentsArcColor
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/alignmentsArcColorConfigSchema.ts).

The alignments displays' `readConnections.color` setting colors the
read-connection arcs and the read cloud. Empty, the default, the arcs take
the reads' `color` field where it is one an arc paints (`insertSize`,
`pairOrientation`, `insertSizeAndOrientation`), and paint
`insertSizeAndOrientation` under any other. A field set here colors the
arcs whatever the reads show. A bare string is refused rather than read as
the field, since the reads' `color` reads one as a constant.

## Example usage

```js
{
  type: 'LinearAlignmentsDisplay',
  readConnections: { show: true, color: { field: 'pairOrientation' } },
}
```

```js
{
  type: 'LinearAlignmentsDisplay',
  readConnections: { show: true, mark: 'cloud' },
  color: { field: 'insertSize' },
}
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) ("", insertSizeAndOrientation, insertSize, pairOrientation) = <code>''</code> | the pair field the arcs paint: insertSizeAndOrientation, insertSize or pairOrientation; empty takes the reads' color field where an arc paints it |
