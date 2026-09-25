---
id: alignmentsarccolor
title: AlignmentsArcColor
sidebar_label: Display -> AlignmentsArcColor
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/alignmentsArcColorConfigSchema.ts).

## Example usage

```js
{ type: 'LinearAlignmentsDisplay', readConnections: 'arc', arcColor: 'pairOrientation' }
```

```js
{
  type: 'LinearAlignmentsDisplay',
  readConnections: 'cloud',
  color: { field: 'insertSize' },
}
```

_See the **Config slots** section below for all available configuration fields._

The alignments displays' `arcColor` setting: what colours the
read-connection arcs and the read cloud. Empty, the default, the arcs take the reads'
`color` field where it is one an arc paints (`insertSize`,
`pairOrientation`, `insertSizeAndOrientation`), and paint
`insertSizeAndOrientation` under any other. A field of its own colours the
arcs whatever the reads show. A string is the field.

## Config slots

These slots go on a display entry: `"displays": [{ "type": "AlignmentsArcColor", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) ("", insertSizeAndOrientation, insertSize, pairOrientation) = <code>''</code> | the pair field the arcs paint: insertSizeAndOrientation, insertSize or pairOrientation; empty takes the reads' color field where an arc paints it |
