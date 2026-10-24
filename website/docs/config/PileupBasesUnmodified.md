---
id: pileupbasesunmodified
title: PileupBasesUnmodified
description: "The pileup's bases.unmodified layer: the unmodified side of the modifications and bisulfite fields, in blue."
sidebar_label: Display -> PileupBasesUnmodified
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/pileupBasesUnmodifiedConfigSchema.ts).

The pileup's `bases.unmodified` layer: the unmodified side of the
`modifications` and `bisulfite` fields, in blue. Under `modifications` it
paints every cytosine in the `context` a read's 5mC calls left implicit, the methylation view, and each other call more likely
unmodified; the probability floor does not apply.

## Example usage

```js
{
  type: 'LinearAlignmentsDisplay',
  pileup: {
    bases: {
      show: true,
      encoding: { color: 'modifications' },
      unmodified: { show: true },
    },
  },
}
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | paint the unmodified side blue under the modifications and bisulfite fields |
