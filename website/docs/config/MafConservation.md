---
id: mafconservation
title: MafConservation
description: "The MAF display's conservation setting: the band of identity to the reference drawn above the rows, its height, and the unit one bar stands for."
sidebar_label: Display -> MafConservation
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `maf` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/LinearMafDisplay/mafConservationConfigSchema.ts).

The MAF display's `conservation` setting: the band of identity to the
reference drawn above the rows, its height, and the unit one bar stands
for.

## Example usage

```js
{ type: 'LinearMafDisplay', conservation: { show: true, unit: 'codon' } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | draw the conservation band |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>40</code> | height of the conservation band in pixels |
| <span id="slot-unit">**unit**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) = <code>'base'</code> | `codon` reads frames off the MAF adapter's `framesAdapter`. |
