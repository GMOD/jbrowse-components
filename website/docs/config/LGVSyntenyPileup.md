---
id: lgvsyntenypileup
title: LGVSyntenyPileup
description: "The LGVSyntenyDisplay's pileup setting: the Pileup object with collapsed defaulting to on, so an all-vs-all track faceted by mate assembly draws each mate genome as one band, repeat depth shown as…"
sidebar_label: Display setting -> LGVSyntenyPileup
---

Auto-generated from the config schema in the source. See the [config guide](/docs/config_guide) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LGVSyntenyDisplay/lgvSyntenyPileupConfigSchema.ts).

The LGVSyntenyDisplay's `pileup` setting: the [Pileup](../pileup) object
with `collapsed` defaulting to on, so an all-vs-all track faceted by mate
assembly draws each mate genome as one band, repeat depth shown as darker
shading rather than as extra rows. The alignments display defaults it off,
where a section is a read category and the stack is the information.

## Example usage

```js
{ type: 'LGVSyntenyDisplay', pileup: { collapsed: false } }
```

## Related links

- **Base config:** [Pileup](../pileup)

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-collapsed">**collapsed**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw each facet section as a single row rather than a stack |
| <span class="slot-group">Inherited from [Pileup](../pileup)</span> | <span class="slot-group-count">7 slots</span> |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw the pileup band |
| <span id="slot-mark">**mark**</span><br>[PileupMark](../pileupmark) | The bar each read draws as: `height`. |
| <span id="slot-maxlayoutheight">**maxLayoutHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>6000</code> | the tallest the pileup's layout grows in pixels; reads past it are not stacked, and coverage still counts them. Not the display's growMaxHeight, which caps how tall the track grows<br>_advanced_ |
| <span id="slot-mismatches">**mismatches**</span><br>[PileupMismatches](../pileupmismatches) | How reads differ from the reference: `show`, and `encoding.opacity`, the fade by base quality. |
| <span id="slot-softclips">**softClips**</span><br>[PileupSoftClips](../pileupsoftclips) | The soft-clipped ends of each read: `show`. |
| <span id="slot-connectors">**connectors**</span><br>[PileupConnectors](../pileupconnectors) | Lines over the pileup joining each read to its mate or split segment: `show`. |
| <span id="slot-fadelowfrequency">**fadeLowFrequency**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | fade each sub-pixel mismatch, insertion, deletion and clip mark by the share of reads at its position that have it: a mark every read has stays opaque, and one under the depth-dependent noise threshold drops to the sub-pixel floor and, past one base per pixel, takes no clicks. Off draws them all at full opacity. The coverage band is not faded<br>_advanced_ |
