---
id: mafalignments
title: MafAlignments
description: "The MAF display's alignments setting: the per-species rows, the band that takes the height the bands above it leave, and the parts drawn over them."
sidebar_label: Display -> MafAlignments
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `maf` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/LinearMafDisplay/mafAlignmentsConfigSchema.ts).

The MAF display's `alignments` setting: the per-species rows, the band that
takes the height the bands above it leave, and the parts drawn over them.
Letters draw over every cell `color` paints with its base's color, so
`color: 'base'` letters every base and `mismatch` only the mismatches; they
keep the case the file gives them, lowercase being soft-masked repeat in a
UCSC alignment.

## Example usage

```js
{ type: 'LinearMafDisplay', alignments: { inversions: { show: true } } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | When off, only the bands above the rows render. |
| <span id="slot-rowproportion">**rowProportion**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0.8</code> | fraction of the row height each glyph fills |
| <span id="slot-inversions">**inversions**</span><br>[MafPart](../mafpart) | `show` hatches each block a species aligns on the other strand from the rest of its blocks on that source chromosome. |
| <span id="slot-frames">**frames**</span><br>[MafPart](../mafpart) | `show` draws each species' CDS reading frames from the MAF adapter's `framesAdapter` (UCSC `mafFrames`) as a strip over its row; no effect without one. |
| <span id="slot-reference">**reference**</span><br>[MafReferenceRow](../mafreferencerow) | `show` gives the reference species, which every other row is scored against, a row of its own; on by default. |
