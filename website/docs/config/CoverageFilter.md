---
id: coveragefilter
title: CoverageFilter
description: "The allele segments a coverage band colors, its coverage.filter. The band's grey depth bar shows through where a segment is hidden."
sidebar_label: Display -> CoverageFilter
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/alignments-core/src/coverageFilterConfigSchema.ts).

## Example usage

```js
{
  type: 'LinearAlignmentsDisplay',
  coverage: { filter: { minAlleleFraction: 0.05 } },
}
```

The allele segments a coverage band colors, its `coverage.filter`. The
band's grey depth bar shows through where a segment is hidden.

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-minallelefraction">**minAlleleFraction**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | an allele segment colors only with at least this share of its position's depth, so the band stops painting a sliver for every sequencing error at high depth; 0 colors every mismatch |
