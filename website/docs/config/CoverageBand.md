---
id: coverageband
title: CoverageBand
description: "The coverage histogram band of the alignments and MAF displays, their coverage setting: whether it draws, its height, the insertion and clip marks drawn in it, and which allele segments it colors."
sidebar_label: Display -> CoverageBand
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/alignments-core/src/coverageBandConfigSchema.ts).

## Example usage

```js
{ type: 'LinearAlignmentsDisplay', coverage: { height: 80 } }
```

```js
{ type: 'LinearAlignmentsDisplay', coverage: { show: false } }
```

The coverage histogram band of the alignments and MAF displays, their
`coverage` setting: whether it draws, its height, the insertion and clip
marks drawn in it, and which allele segments it colors. Its value axis is
the display's `scales`.

## Related links

- **Extended by:** [LGVSyntenyCoverage](../lgvsyntenycoverage)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw the coverage band |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>45</code> | height of the coverage band in pixels |
| <span id="slot-showinterbaseindicators">**showInterbaseIndicators**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw the insertion and clip count bars and their indicator triangles |
| <span id="slot-minallelefraction">**minAlleleFraction**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | A color rule, beside the pileup's `fadeLowFrequency`, which fades its marks by the same per-base share through a depth-dependent threshold. The band's grey depth bar shows through where a segment is not colored. |
