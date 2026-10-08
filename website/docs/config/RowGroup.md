---
id: rowgroup
title: RowGroup
description: "One entry of the multi-row feature display's rowGroups: a row joins the group of the first entry whose match regex its name matches, and rowColor: { field: 'group' } colors the groups."
sidebar_label: Display -> RowGroup
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `canvas` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/LinearMultiRowFeatureDisplay/rowGroupConfigSchema.ts).

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
`rowColor: { field: 'group' }` colors the groups.

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-match">**match**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | a regex a row name has to match; one that does not compile matches nothing |
| <span id="slot-group">**group**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | the group a matching row joins |
