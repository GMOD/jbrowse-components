---
id: pileupmismatchesopacity
title: PileupMismatchesOpacity
description: "The pileup's mismatches.encoding.opacity. Unset, each mismatched base fades by its Phred base quality through a linear scale, by default from 0.1 at Q5 to opaque from Q20 up."
sidebar_label: Display setting -> PileupMismatchesOpacity
---

Auto-generated from the config schema in the source. See the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/pileupMismatchesOpacityConfigSchema.ts).

The pileup's `mismatches.encoding.opacity`. Unset, each mismatched base
fades by its Phred base quality through a linear scale, by default from 0.1
at Q5 to opaque from Q20 up. A number is a constant opacity for every
mismatch, written to `value`: `1` draws them all opaque. A string is the
field. A base whose read carries no qualities draws opaque.

## Example usage

```js
{
  type: 'LinearAlignmentsDisplay',
  pileup: { mismatches: { encoding: { opacity: 1 } } },
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
          scale: { domainMin: 0, domainMax: 30, range: [0.2, 1] },
        },
      },
    },
  },
}
```

## Config slots

A setting written to it replaces it whole: a member left out returns to its default. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-value">**value**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | Every mismatch's opacity, 0 to 1, while no field fades them; a base whose read carries no qualities still draws opaque. Writing `opacity: 1` lands here. |
| <span id="slot-field">**field**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (baseQuality) | baseQuality fades each mismatched base by its Phred quality; unset follows value, and with neither written fades by baseQuality |
| <span id="slot-scale">**scale**</span><br>[PileupMismatchesOpacityScale sub-schema](#slot-scaledomainmin) | How a base quality maps to an opacity. |
| <span id="slot-scaledomainmin">**scale.domainMin**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>QUALITY_OPACITY_DOMAIN[0]</code> | the Phred quality that takes the first opacity in range |
| <span id="slot-scaledomainmax">**scale.domainMax**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>QUALITY_OPACITY_DOMAIN[1]</code> | the Phred quality that takes the last opacity in range |
| <span id="slot-scalerange">**scale.range**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>QUALITY_OPACITY_RANGE.map(String)</code> | the opacities, 0 to 1, at the two ends of the domain |
| <span id="slot-scaleclamp">**scale.clamp**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | a quality past the domain takes the nearer end of the range; off, the line runs on until the base is fully opaque or gone |
