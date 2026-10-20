---
id: lineargenomeviewaxis
title: LinearGenomeViewAxis
description: "The linear genome view's axis: the ruler along its top, whose ticks grid carries down through the tracks."
sidebar_label: View -> LinearGenomeViewAxis
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `linear-genome-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/LinearGenomeView/axisConfigSchema.ts).

The linear genome view's `axis`: the ruler along its top, whose ticks
`grid` carries down through the tracks.

## Example usage

```js
{ type: 'LinearGenomeView', axis: { grid: false } }
```

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-grid">**grid**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | carry the ruler's ticks down through the tracks |
