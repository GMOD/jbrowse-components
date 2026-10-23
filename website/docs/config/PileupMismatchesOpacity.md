---
id: pileupmismatchesopacity
title: PileupMismatchesOpacity
description: "The pileup's mismatches.encoding.opacity: unset, every mismatched base draws opaque; baseQuality fades each one by its Phred base quality through a linear scale, by default from transparent at 0 to…"
sidebar_label: Display -> PileupMismatchesOpacity
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/pileupMismatchesOpacityConfigSchema.ts).

The pileup's `mismatches.encoding.opacity`: unset, every mismatched base
draws opaque; `baseQuality` fades each one by its Phred base quality
through a linear scale, by default from transparent at 0 to opaque from 50
up. A string is the field. A base whose read carries no qualities draws
opaque.

## Example usage

```js
{
  type: 'LinearAlignmentsDisplay',
  pileup: { mismatches: { encoding: { opacity: 'baseQuality' } } },
}
```

```js
{
  type: 'LinearAlignmentsDisplay',
  pileup: {
    mismatches: {
      encoding: {
        opacity: {
          field: 'baseQuality',
          scale: { domain: [0, 30], range: [0.2, 1] },
        },
      },
    },
  },
}
```

## Config slots

A setting written to it replaces it whole, since its members are alternatives: a member left out returns to its default. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (baseQuality) | baseQuality fades each mismatched base by its Phred quality; unset draws them opaque |
| <span id="slot-scale">**scale**</span><br>[PileupMismatchesOpacityScale sub-schema](#slot-scaledomain) | How a base quality maps to an opacity. |
| <span id="slot-scaledomain">**scale.domain**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>['0', '50']</code> | the Phred qualities that take the first and the last opacity in range |
| <span id="slot-scalerange">**scale.range**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>['0', '1']</code> | the opacities, 0 to 1, at the two ends of the domain |
| <span id="slot-scaleclamp">**scale.clamp**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | a quality past the domain takes the nearer end of the range; off, the line runs on until the base is fully opaque or gone |
