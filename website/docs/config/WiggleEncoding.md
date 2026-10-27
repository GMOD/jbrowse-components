---
id: wiggleencoding
title: WiggleEncoding
description: "The quantitative display's encoding, the channels its marks paint through."
sidebar_label: Display setting -> WiggleEncoding
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `wiggle` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/shared/wiggleEncodingConfigSchema.ts).

The quantitative display's `encoding`, the channels its marks paint
through.

## Example usage

```js
{ type: 'LinearWiggleDisplay', encoding: { color: { value: 'darkgreen' } } }
```

The bins' maxima on a log axis, with a labelled line at 30:

```js
{
  type: 'LinearWiggleDisplay',
  encoding: {
    y: {
      field: 'maxScore',
      scale: { type: 'log' },
      rules: [{ value: 30, label: '2 copies' }],
    },
  },
}
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-color">**color**</span><br>[WiggleColor](../wigglecolor) | One CSS color in `value`, or the score through a `scale`, with a key. |
| <span id="slot-y">**y**</span><br>[YFieldChannel](../yfieldchannel) | The value axis, a [YFieldChannel](../yfieldchannel): `field`, the summary or column each mark plots, and the `scale`, `axis` and `rules` it is drawn through. `scale.fenceQuantile` starts at 0.99, fencing a spike. The density rendering draws no rule and does not widen to one: it spends color on the score and has no axis to rule. |
| <span id="slot-size">**size**</span><br>[WiggleSize](../wigglesize) | A point's diameter in px. The track menu's Point size writes it. |
| <span id="slot-strokewidth">**strokeWidth**</span><br>[WiggleSize](../wigglesize) | A line's width in px, Vega-Lite's stroke width. The track menu's Line width writes it. |
