---
id: lgvsyntenycoverage
title: LGVSyntenyCoverage
description: "The LGVSyntenyDisplay's coverage setting: the CoverageBand object with show defaulting to off."
sidebar_label: Display -> LGVSyntenyCoverage
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LGVSyntenyDisplay/lgvSyntenyCoverageConfigSchema.ts).

The LGVSyntenyDisplay's `coverage` setting: the
[CoverageBand](../coverageband) object with `show` defaulting to off.

## Example usage

```js
{ type: 'LGVSyntenyDisplay', coverage: { show: true } }
```

## Related links

- **Base config:** [CoverageBand](../coverageband)

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | draw the coverage band |
| <span class="slot-group">Inherited from [CoverageBand](../coverageband)</span> | <span class="slot-group-count">4 slots</span> |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>45</code> | height of the coverage band in pixels |
| <span id="slot-encoding">**encoding**</span><br>[CoverageEncoding](../coverageencoding) | The depth axis, `encoding.y`: its `scale`, `axis` and `rules`. |
| <span id="slot-interbase">**interbase**</span><br>[CoverageInterbase](../coverageinterbase) | The insertion and clip marks between bases: `show`, and the `filter` deciding which positions get an indicator triangle. |
| <span id="slot-alleles">**alleles**</span><br>[CoverageAlleles](../coveragealleles) | The colored allele segments: the `filter` on each one's `fraction`. |
