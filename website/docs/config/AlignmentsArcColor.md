---
id: alignmentsarccolor
title: AlignmentsArcColor
description: "The alignments displays' readConnections.encoding.color colors the read-connection arcs and the read cloud."
sidebar_label: Display setting -> AlignmentsArcColor
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/alignmentsArcColorConfigSchema.ts).

The alignments displays' `readConnections.encoding.color` colors the
read-connection arcs and the read cloud. Empty, the default, the arcs take
the reads' `encoding.color` field where it is one an arc paints
(`insertSizeAndOrientation` or `pairOrientation`), and paint
`insertSizeAndOrientation` under any other. A field set here colors the
arcs whatever the reads show. A string is the field.

## Example usage

```js
{
  type: 'LinearAlignmentsDisplay',
  readConnections: { show: true, encoding: { color: 'pairOrientation' } },
}
```

```js
{
  type: 'LinearAlignmentsDisplay',
  readConnections: { show: true, mark: 'rule' },
  encoding: { color: 'pairOrientation' },
}
```

## Config slots

A setting written to it replaces it whole: a member left out returns to its default. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (insertSizeAndOrientation, pairOrientation) | the pair field the arcs paint: insertSizeAndOrientation or pairOrientation; unset takes the reads' color field where an arc paints it |
