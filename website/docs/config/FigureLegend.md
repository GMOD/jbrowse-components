---
id: figurelegend
title: FigureLegend
description: "The legend of a display whose key is off on screen until asked for but drawn in an SVG export, a matrix's color ramp: a heatmap figure needs its scale where a browsing reader does not."
sidebar_label: Display setting -> FigureLegend
---

Auto-generated from the config schema in the source. See the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/figureLegendConfigSchema.ts).

The `legend` of a display whose key is off on screen until asked for but
drawn in an SVG export, a matrix's color ramp: a heatmap figure needs its
scale where a browsing reader does not.

## Example usage

```js
{ type: 'LinearHicDisplay', legend: { show: false } }
```

## Related links

- **Base config:** [Legend](../legend)

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) | draw the key; unset draws it in an SVG export and not on screen |
