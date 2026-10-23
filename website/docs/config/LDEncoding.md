---
id: ldencoding
title: LDEncoding
description: "The LD display's encoding: color, the statistic the cells paint."
sidebar_label: Display -> LDEncoding
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `variants` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LDDisplay/ldEncodingConfigSchema.ts).

The LD display's `encoding`: `color`, the statistic the cells paint.

## Example usage

```js
{ type: 'LDTrackDisplay', encoding: { color: 'dprime' } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-color">**color**</span><br>[LDColor](../ldcolor) | The statistic the cells show, `field` `r2` or `dprime`, and the linear ramp it paints through over the statistic's 0 to 1. |
