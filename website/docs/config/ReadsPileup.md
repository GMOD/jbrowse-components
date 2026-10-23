---
id: readspileup
title: ReadsPileup
description: "LinearAlignmentsDisplay's pileup: the Pileup band with the per-base layer over the reads, bases, which a synteny block, having no qualities or basecaller tags, goes without."
sidebar_label: Display -> ReadsPileup
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/readsPileupConfigSchema.ts).

LinearAlignmentsDisplay's `pileup`: the [Pileup](../pileup) band with the
per-base layer over the reads, `bases`, which a synteny block, having no
qualities or basecaller tags, goes without.

## Example usage

```js
{
  type: 'LinearAlignmentsDisplay',
  pileup: { bases: { show: true, encoding: { color: 'modifications' } } },
}
```

## Related links

- **Base config:** [Pileup](../pileup)

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-bases">**bases**</span><br>[PileupBases](../pileupbases) | The per-base layer: `show` and `encoding.color`. |
| <span class="slot-group">Inherited from [Pileup](../pileup)</span> | <span class="slot-group-count">8 slots</span> |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw the pileup band |
| <span id="slot-readheight">**readHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>7</code> | The one compactness setting: the spacing between reads follows from it (`featureSpacingForHeight`), and the Normal, Compact and Super-compact presets (7, 3, 1) and the fit-mode squeeze all write or read it. |
| <span id="slot-maxlayoutheight">**maxLayoutHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>6000</code> | the tallest the pileup's layout grows in pixels; reads past it are not stacked, and coverage still counts them. Not the display's growMaxHeight, which caps how tall the track grows<br>_advanced_ |
| <span id="slot-mismatches">**mismatches**</span><br>[PileupMismatches](../pileupmismatches) | How reads differ from the reference: `show`. |
| <span id="slot-softclips">**softClips**</span><br>[PileupSoftClips](../pileupsoftclips) | The soft-clipped ends of each read: `show`. |
| <span id="slot-connectors">**connectors**</span><br>[PileupConnectors](../pileupconnectors) | Lines over the pileup joining each read to its mate or split segment: `show`. |
| <span id="slot-fadelowbasequality">**fadeLowBaseQuality**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | fade each mismatch base by its Phred base quality: opaque from 50 up, fading linearly below |
| <span id="slot-fadelowfrequency">**fadeLowFrequency**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | fade each sub-pixel mismatch, insertion, deletion and clip mark by the share of reads at its position that have it: a mark every read has stays opaque, and one under the depth-dependent noise threshold drops to the sub-pixel floor and, past one base per pixel, takes no clicks. Off draws them all at full opacity. The coverage band is not faded (see runCoveragePipeline)<br>_advanced_ |
