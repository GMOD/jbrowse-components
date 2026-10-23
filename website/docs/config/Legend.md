---
id: legend
title: Legend
description: "A display's legend: whether it draws its key, every channel's sections together. Hiding one section is the key's own close button, which the session forgets."
sidebar_label: Display -> Legend
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/legendConfigSchema.ts).

A display's `legend`: whether it draws its key, every channel's sections
together. Hiding one section is the key's own close button, which the
session forgets.

## Example usage

```js
{ type: 'LinearBasicDisplay', legend: { show: false } }
```

## Related links

- **Extended by:** [HiddenLegend](../hiddenlegend)

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw the key |
