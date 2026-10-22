---
id: pileupsoftclips
title: PileupSoftClips
description: "The pileup's softClips layer: the bases at each end of a read the aligner soft-clipped, drawn past the aligned span."
sidebar_label: Display -> PileupSoftClips
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/pileupSoftClipsConfigSchema.ts).

The pileup's `softClips` layer: the bases at each end of a read the aligner
soft-clipped, drawn past the aligned span.

## Example usage

```js
{ type: 'LinearAlignmentsDisplay', pileup: { softClips: { show: true } } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | draw the soft-clipped ends of each read |
