---
id: pileup
title: Pileup
description: "The alignments display's pileup setting: the band of stacked reads, its read height and layout cap, and the parts drawn on each read."
sidebar_label: Display -> Pileup
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/pileupConfigSchema.ts).

## Example usage

```js
{
  type: 'LinearAlignmentsDisplay',
  pileup: { readHeight: 3, showSoftClipping: true },
}
```

The alignments display's `pileup` setting: the band of stacked reads, its
read height and layout cap, and the parts drawn on each read.

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw the pileup band |
| <span id="slot-readheight">**readHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>7</code> | The one compactness setting: the spacing between reads follows from it (`featureSpacingForHeight`), and the Normal, Compact and Super-compact presets (7, 3, 1) and the fit-mode squeeze all write or read it. |
| <span id="slot-maxlayoutheight">**maxLayoutHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>6000</code> | the tallest the pileup's layout grows in pixels; reads past it are not stacked, and coverage still counts them. Not the display's growMaxHeight, which caps how tall the track grows<br>_advanced_ |
| <span id="slot-showmismatches">**showMismatches**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw how reads differ from the reference: per-base mismatches, insertion markers and deletion bars. The line joining a spliced read across its introns draws either way, since it shows the exon blocks are one read (PILEUP_MARKS) |
| <span id="slot-showsoftclipping">**showSoftClipping**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | draw the soft-clipped ends of each read |
| <span id="slot-showoutline">**showOutline**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) | Unset, the outline follows the unit: drawn under `unit: 'chain'`.<br>_advanced_ |
| <span id="slot-showconnectors">**showConnectors**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | draw a connector over the pileup from each read to its mate or split segment: a straight line for a normal pair within one displayed region, a curve otherwise. Under unit: 'chain' a link between displayed regions curves either way. The arc and read-cloud band is readConnections |
| <span id="slot-fadelowbasequality">**fadeLowBaseQuality**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | fade each mismatch base by its Phred base quality: opaque from 50 up, fading linearly below |
| <span id="slot-fadelowfrequency">**fadeLowFrequency**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | fade each sub-pixel mismatch, insertion, deletion and clip mark by the share of reads at its position that have it: a mark every read has stays opaque, and one under the depth-dependent noise threshold drops to the sub-pixel floor and, past one base per pixel, takes no clicks. Off draws them all at full opacity. The coverage band is not faded (see runCoveragePipeline)<br>_advanced_ |
