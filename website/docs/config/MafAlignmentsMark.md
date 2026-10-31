---
id: mafalignmentsmark
title: MafAlignmentsMark
description: "The MAF rows' mark, the glyph each aligned base draws as: its height, spelled as the mark display's rect."
sidebar_label: Display setting -> MafAlignmentsMark
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `maf` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/LinearMafDisplay/mafAlignmentsMarkConfigSchema.ts).

The MAF rows' `mark`, the glyph each aligned base draws as: its `height`,
spelled as the mark display's `rect`.

## Example usage

```js
{ type: 'LinearMafDisplay', alignments: { mark: { height: { band: 0.9 } } } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-heightband">**height.band**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0.8</code> | The fraction of its row a species' glyphs fill, centred in the row, so below 1 the rows stand apart. The track menu's Row height presets write it. |
| <span id="slot-height">**height**</span><br>[MafAlignmentsMarkHeight sub-schema](#slot-heightband) | The height a glyph draws at, as a fraction of its row: `{ band: 0.8 }`, Vega-Lite's spelling. |
