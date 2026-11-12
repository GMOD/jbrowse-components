---
id: marktooltip
title: MarkTooltip
description: "The mark display's tooltip, the box hovering a mark opens: whether it shows, and the field naming the hovered feature on its first line, above the locus and each channel's value."
sidebar_label: Display setting -> MarkTooltip
---

Auto-generated from the config schema in the source. See the [config guide](/docs/config_guide) for concepts. Provided by the `marks` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/marks/src/LinearMarkDisplay/markTooltipConfigSchema.ts).

The mark display's `tooltip`, the box hovering a mark opens: whether it
`show`s, and the `field` naming the hovered feature on its first line,
above the locus and each channel's value. A bare string is the field.
Unwritten, the field is empty and the box names no feature, so a plot of
dense values, a Manhattan or a coverage, ships no string per mark.

## Example usage

```js
{ type: 'LinearMarkDisplay', tooltip: 'name' }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Off, hovering a mark opens no box. |
| <span id="slot-field">**field**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>''</code> | The field the box's first line reads off the feature the mark draws, such as `name`, or a `jexl:` expression over `feature`; one that reads nothing names the feature, else its ID, as a feature track's tooltip does. Empty names nothing. |
