---
id: linearsyntenyaxis
title: LinearSyntenyAxis
description: "The linear synteny view's axis: each row's ruler, whose ticks grid carries down through the ribbons to the coordinates they pair with on the row below, so a ribbon's shear and stretch show."
sidebar_label: View -> LinearSyntenyAxis
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LinearSyntenyView/axisConfigSchema.ts).

The linear synteny view's `axis`: each row's ruler, whose ticks `grid`
carries down through the ribbons to the coordinates they pair with on the
row below, so a ribbon's shear and stretch show.

## Example usage

```js
{ type: 'LinearSyntenyView', axis: { grid: true } }
```

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-grid">**grid**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | carry each row's ruler ticks down through the ribbons |
