---
id: coveragealleles
title: CoverageAlleles
description: "The coverage band's alleles layer: the colored segment each mismatched base takes in its position's depth bar."
sidebar_label: Display -> CoverageAlleles
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/alignments-core/src/coverageAllelesConfigSchema.ts).

The coverage band's `alleles` layer: the colored segment each mismatched
base takes in its position's depth bar. Its `filter` keeps the segments
whose `fraction`, the allele's share of the position's depth, passes;
the grey depth bar shows through where a segment is left out.

## Example usage

```js
{
  type: 'LinearAlignmentsDisplay',
  coverage: { alleles: { filter: [{ field: 'fraction', gte: 0.2 }] } },
}
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-filter">**filter**</span><br>[FieldPredicate](../fieldpredicate) | Entries on `fraction`, a floor from 0 to 1 written `gte`, the one test the band's draw makes. Empty colors every mismatch, sequencing errors included. Distinct from `pileup.fadeLowFrequency`, which fades the pileup's marks by the same share through a depth-dependent threshold. |
