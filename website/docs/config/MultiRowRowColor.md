---
id: multirowrowcolor
title: MultiRowRowColor
sidebar_label: Display -> MultiRowRowColor
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `canvas` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/LinearMultiRowFeatureDisplay/multiRowRowColorConfigSchema.ts).

## Example usage

```js
{
  type: 'LinearMultiRowFeatureDisplay',
  rowColor: { domain: ['HG00096', 'HG00097'], range: ['#4e79a7', '#f28e2b'] },
}
```

_See the **Config slots** section below for all available configuration fields._

The multi-row feature display's `rowColor`: a colour per row, by the row's
value, as `domain`/`range` pairs. It paints every block on the row over the
colour each feature carries, and the arrangement dialog's Row color column
edits it.

## Config slots

These slots go on a display entry: `"displays": [{ "type": "MultiRowRowColor", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-domain">**domain**</span><br>`stringArray` = <code>[]</code> | the rows given a colour of their own, by value |
| <span id="slot-range">**range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | the CSS colour each row in domain takes, in the same order |
