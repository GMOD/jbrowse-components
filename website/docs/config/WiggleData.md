---
id: wiggledata
title: WiggleData
description: "What a quantitative display's fetch reads of a tiered file: resolution is the points per pixel it asks for."
sidebar_label: Display -> WiggleData
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `wiggle` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/shared/wiggleDataConfigSchema.ts).

What a quantitative display's fetch reads of a tiered file: `resolution` is
the points per pixel it asks for.

## Example usage

```json
{ "type": "LinearWiggleDisplay", "data": { "resolution": 4 } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-resolution">**resolution**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | points per pixel the fetch asks a tiered file for: 1 is one per pixel, larger is finer and smaller is coarser. Clamped to the range the Resolution menu offers, so a value outside it reads as the nearest end |
