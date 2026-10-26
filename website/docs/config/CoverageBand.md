---
id: coverageband
title: CoverageBand
description: "The coverage histogram band of the alignments and MAF displays, their coverage setting: whether it draws, its height, the insertion and clip marks drawn in it (interbase), which allele segments it…"
sidebar_label: Display setting -> CoverageBand
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/alignments-core/src/coverageBandConfigSchema.ts).

The coverage histogram band of the alignments and MAF displays, their
`coverage` setting: whether it draws, its height, the insertion and clip
marks drawn in it (`interbase`), which allele segments it colors
(`alleles`), and its depth axis, `encoding.y`. On the alignments display,
the modification bars in it follow the pileup's `bases` layer, which
draws them beside its cells from the same calls.

## Example usage

```js
{ type: 'LinearAlignmentsDisplay', coverage: { height: 80 } }
```

```js
{ type: 'LinearAlignmentsDisplay', coverage: { show: false } }
```

## Related links

- **Extended by:** [LGVSyntenyCoverage](../lgvsyntenycoverage)

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw the coverage band |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>45</code> | height of the coverage band in pixels |
| <span id="slot-encoding">**encoding**</span><br>[CoverageEncoding](../coverageencoding) | The depth axis, `encoding.y`: its `scale`, `axis` and `rules`. |
| <span id="slot-interbase">**interbase**</span><br>[CoverageInterbase](../coverageinterbase) | The insertion and clip marks between bases: `show`, and the `filter` deciding which positions get an indicator triangle. |
| <span id="slot-alleles">**alleles**</span><br>[CoverageAlleles](../coveragealleles) | The colored allele segments: `show`, and the `filter` on each one's `fraction`. |
