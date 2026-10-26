---
id: markdisplayencoding
title: MarkDisplayEncoding
description: "The mark display's encoding: the channels every mark reads unless it says otherwise, as ggplot2's plot-level aesthetics are each layer's. y is the value axis every mark's encoding.y is read through;…"
sidebar_label: Display setting -> MarkDisplayEncoding
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `marks` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/marks/src/LinearMarkDisplay/markDisplayEncodingConfigSchema.ts).

The mark display's `encoding`: the channels every mark reads unless it
says otherwise, as ggplot2's plot-level aesthetics are each layer's. `y`
is the value axis every mark's `encoding.y` is read through; `color` is
the color a mark paints whose own `encoding.color` says nothing.

## Example usage

```js
{
  type: 'LinearMarkDisplay',
  encoding: { y: { scale: { type: 'log' }, axis: { title: 'depth' } } },
}
```

```js
{
  type: 'LinearMarkDisplay',
  encoding: { color: { scale: { type: 'identity' } } },
  marks: [{ mark: 'rect' }],
}
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-y">**y**</span><br>[YChannel](../ychannel) | The value axis every mark's `encoding.y` is read through: `scale`, `axis` and `rules`. |
| <span id="slot-color">**color**</span><br>[MarkColor](../markcolor) | The color of every mark whose own `encoding.color` names no value, field or scale, a [MarkColor](../markcolor). |
