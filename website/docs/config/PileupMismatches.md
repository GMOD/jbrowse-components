---
id: pileupmismatches
title: PileupMismatches
description: "The pileup's mismatches layer: how each read differs from the reference, as per-base mismatches, insertion markers and deletion bars, and the opacity each mismatched base takes from its quality."
sidebar_label: Display -> PileupMismatches
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/pileupMismatchesConfigSchema.ts).

The pileup's `mismatches` layer: how each read differs from the reference,
as per-base mismatches, insertion markers and deletion bars, and the
opacity each mismatched base takes from its quality. The line
joining a spliced read across its introns draws either way, since it shows
the exon blocks are one read.

## Example usage

```js
{ type: 'LinearAlignmentsDisplay', pileup: { mismatches: { show: false } } }
```

```js
{
  type: 'LinearAlignmentsDisplay',
  pileup: { mismatches: { encoding: { opacity: 'baseQuality' } } },
}
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw the mismatched bases, insertion markers and deletion bars |
| <span id="slot-encoding">**encoding**</span><br>[PileupMismatchesEncoding sub-schema](#slot-encodingopacity) | The layer's channels: `encoding.opacity`, which fades each mismatched base by its base quality. |
| <span id="slot-encodingopacity">**encoding.opacity**</span><br>[PileupMismatchesOpacity](../pileupmismatchesopacity) | The fade by base quality: `baseQuality`, through a linear scale. |
