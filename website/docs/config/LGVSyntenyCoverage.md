---
id: lgvsyntenycoverage
title: LGVSyntenyCoverage
description: "The LGVSyntenyDisplay's coverage setting: the CoverageBand object with show defaulting to off."
sidebar_label: Display -> LGVSyntenyCoverage
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LGVSyntenyDisplay/lgvSyntenyCoverageConfigSchema.ts).

## Example usage

```js
{ type: 'LGVSyntenyDisplay', coverage: { show: true } }
```

The LGVSyntenyDisplay's `coverage` setting: the
[CoverageBand](../coverageband) object with `show` defaulting to off.

## Related links

- **Base config:** [CoverageBand](../coverageband)

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | draw the coverage band |
| <span class="slot-group">Inherited from [CoverageBand](../coverageband)</span> | <span class="slot-group-count">3 slots</span> |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>45</code> | height of the coverage band in pixels |
| <span id="slot-showinterbaseindicators">**showInterbaseIndicators**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw the insertion and clip count bars and their indicator triangles |
| <span id="slot-minallelefraction">**minAlleleFraction**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | A color rule, beside the pileup's `fadeLowFrequency`, which fades its marks by the same per-base share through a depth-dependent threshold. The band's grey depth bar shows through where a segment is not colored. |
