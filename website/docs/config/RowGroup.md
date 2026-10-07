---
id: rowgroup
title: RowGroup
sidebar_label: Display -> RowGroup
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `canvas` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/LinearMultiRowFeatureDisplay/rowGroupConfigSchema.ts).

## Example usage

```js
{
  type: 'LinearMultiRowFeatureDisplay',
  rowGroups: [
    { match: '^CLUP', group: 'Wolf' },
    { match: '^CLAT', group: 'Coyote' },
  ],
}
```

_See the **Config slots** section below for all available configuration fields._

One entry of the multi-row feature display's `rowGroups`: a row joins the
`group` of the first entry whose `match` regex its name matches, and
`rowColor: { field: 'group' }` colours the groups.

## Config slots

These slots go on a display entry: `"displays": [{ "type": "RowGroup", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-match">**match**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | a regex a row name has to match; one that does not compile matches nothing |
| <span id="slot-group">**group**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | the group a matching row joins |
