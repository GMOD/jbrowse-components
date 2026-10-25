---
id: rowgroup
title: RowGroup
description: "One entry of a row display's rowGroups: a row joins the group of the first entry whose match regex its name matches, facet: 'group' stacks the groups in bands, and rowColor: { field: 'group' } colors…"
sidebar_label: Display -> RowGroup
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/tree-sidebar/src/rowGroupConfigSchema.ts).

One entry of a row display's `rowGroups`: a row joins the `group` of the
first entry whose `match` regex its name matches, `facet: 'group'` stacks
the groups in bands, and `rowColor: { field: 'group' }` colors them.

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

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-match">**match**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | a regex a row name has to match; one that does not compile matches nothing |
| <span id="slot-group">**group**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | the group a matching row joins |
