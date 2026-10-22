---
id: variantcellencoding
title: VariantCellEncoding
description: "The multi-sample variant display's encoding, the channels its genotype cells paint through."
sidebar_label: Display -> VariantCellEncoding
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `variants` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LinearMultiSampleVariantDisplay/cellEncodingConfigSchema.ts).

The multi-sample variant display's `encoding`, the channels its genotype
cells paint through.

## Example usage

```js
{ type: 'LinearMultiSampleVariantDisplay', encoding: { color: 'svType' } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-color">**color**</span><br>[VariantCellColor](../variantcellcolor) | The hue of every genotype cell with an alt allele: unset, the genotype colors; `{ value }`, a CSS color or `jexl:` callback; or a field, one of the `impact`, `svType` and `phaseSet` presets or any record field, whose values each take a color with a key. |
