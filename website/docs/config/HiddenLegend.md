---
id: hiddenlegend
title: HiddenLegend
description: "The legend of a display whose key is off until asked for, a matrix's color ramp or the reads' fill."
sidebar_label: Display setting -> HiddenLegend
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/hiddenLegendConfigSchema.ts).

The `legend` of a display whose key is off until asked for, a matrix's
color ramp or the reads' fill.

## Related links

- **Base config:** [Legend](../legend)

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | draw the key |
