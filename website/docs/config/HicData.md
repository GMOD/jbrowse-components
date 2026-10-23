---
id: hicdata
title: HicData
description: "What a Hi-C display's fetch reads of the file: resolution steps the binsize from the one the zoom picks, and normalization is the matrix normalization asked for."
sidebar_label: Display -> HicData
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `hic` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/hic/src/LinearHicDisplay/hicDataConfigSchema.ts).

What a Hi-C display's fetch reads of the file: `resolution` steps the
binsize from the one the zoom picks, and `normalization` is the matrix
normalization asked for.

## Example usage

One binsize finer than the zoom picks, with vanilla coverage:

```json
{
  "type": "LinearHicDisplay",
  "data": { "resolution": 1, "normalization": "VC" }
}
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-resolution">**resolution**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | binsizes finer than the zoom picks: 1 one finer, -1 one coarser, 0 follows the zoom |
| <span id="slot-normalization">**normalization**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'KR'</code> | preferred matrix normalization (KR, SCALE, VC, VC_SQRT, NONE); a scheme the file lacks falls back to one it has |
