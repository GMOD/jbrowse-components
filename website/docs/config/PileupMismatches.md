---
id: pileupmismatches
title: PileupMismatches
description: "The pileup's mismatches layer: how each read differs from the reference, as per-base mismatches, insertion markers and deletion bars."
sidebar_label: Display -> PileupMismatches
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/pileupMismatchesConfigSchema.ts).

The pileup's `mismatches` layer: how each read differs from the reference,
as per-base mismatches, insertion markers and deletion bars. The line
joining a spliced read across its introns draws either way, since it shows
the exon blocks are one read (PILEUP_MARKS).

## Example usage

```js
{ type: 'LinearAlignmentsDisplay', pileup: { mismatches: { show: false } } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw the mismatched bases, insertion markers and deletion bars |
