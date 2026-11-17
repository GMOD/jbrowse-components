---
name: the-track-list-config-speaks-the-grammar
description: The track selector's config (`configuration.hierarchical`) as grammar roles, sort, group, columns and filter as field objects, in place of its booleans and the filter chips' private filter map. Read before adding a slot to `hierarchical` or a starting filter to the track table.
---

# The track list config speaks the grammar

Colin, 2026-11-16: "trying to allow the tracklist 'configuration' to use
'grammar of graphics' like naming could be useful … not required but just an
idea". Parked until he wants it; nothing below is built.

## Today

`configuration.hierarchical` (`packages/product-core/src/RootModel/HierarchicalConfig.ts`):

```json
{
  "sort": { "trackNames": false, "categories": false },
  "defaultFolderCategories": ["ENCODE"],
  "defaultCollapsed": {
    "categoryNames": ["RNA-seq"],
    "topLevelCategories": false,
    "subCategories": false
  },
  "table": { "columns": ["metadata.assay", "metadata.biosample"] }
}
```

Two booleans for sort, three for collapse, a folder list keyed by category
name, and one field list (ADR-269). The filter chips (ADR-271) keep their own
`Map<field, string[]>` of checked values, which no config or session can
state.

## The sketch

The track list is a table of tracks; its config states which fields it sorts,
groups, shows and filters by, each as a `field` object:

```json
{
  "trackList": {
    "sort": [{ "field": "category" }, { "field": "name" }],
    "group": { "field": "category" },
    "columns": ["metadata.assay", "metadata.biosample", "metadata.target"],
    "filter": [{ "field": "metadata.assay", "oneOf": ["ChIP-seq"] }]
  }
}
```

- **`sort`**: a list of `{ field, order? }`, Vega-Lite's sort, in place of
  `sort.trackNames` and `sort.categories`. Absent is config order.
- **`group`**: the field the tree folds into folders (today always
  `category`, a path). Collapse and folder state stay per category value, as
  the user's own.
- **`columns`**: `table.columns` as it is (ADR-269); a list of field paths.
- **`filter`**: `FieldPredicate[]` (`packages/core/src/util/fieldPredicate.ts`,
  ADR-238), the same predicate the displays filter with. A facet selection is
  `{ field, oneOf }`, so the filter chips' private map becomes this list, a
  config can state a starting filter, and a session can save one.

## Open questions

- **The word for the tree's folders.** `group` matches Vega-Lite's
  `groupby`; `rows` and `facet` are taken by the display grammar with other
  meanings (ADR-130, ADR-157).
- **Renaming `hierarchical`.** It names the widget, not the list. A rename
  moves every existing config through a `retired` key.
- **`defaultCollapsed` and `defaultFolderCategories`.** They state starting
  UI state per category value; they may stay as they are under the new
  object, or become `group.collapsed` and `group.folders`.

Run it the way vocabulary questions are run here: a factual inventory, a cold
Fable design, then an adversarial review of the end state, before any code.
