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

## Review, 2026-11-17

Three reviewers (design against the ADRs, mechanism, a cold product read)
read this sketch alongside the removal of the track selector's ☰ menu. All
three put the menu change first and this idea after it: with the tree's sort
checkboxes gone, config is the only thing that sorts the tree. The sketch has
these problems:

- **`trackList` is taken.** It is the model's All / Favorites / Recent state
  (`HierarchicalTrackSelectorWidget/model.ts`). `trackSelector` names what
  the UI already calls it.
- **`group` already means something.** It is the subadapter attribute in
  `rows: { field: 'group' }` (ADR-270), and ADR-157 set it aside for a band
  of subtracks. Once `filter` takes over from the chips, `facet` is free
  inside the track list, and it is the display grammar's word for labelled
  sections split by a field.
- **`sort: [category, name]` reads as a row sort.** It cannot say "folders
  A–Z, tracks in config order". Give the folder field its own sort, as
  ADR-237 does for a facet: `{ field: 'category', sort }`. The top-level
  `sort` then orders tracks within a folder and is the config form of the
  table's header sort.
- **The folder object absorbs the booleans.** `defaultCollapsed.*` and
  `defaultFolderCategories` become fields of it, e.g. `collapsed` and
  `folders`. Say once that the whole object is starting state the user
  overrides, so the `default` prefix can go.
- **A one-key folder object forecloses grouping by two fields** (assay, then
  biosample), the first thing a metadata-rich hub will want. A list does not.
- **Accept a bare string for `{ field }`.** `columns` takes strings, and an
  agent will write `sort: ["name"]`.
- **Migration needs a new parent key.** `retired` cannot lift a key the schema
  still declares (`configurationSchema.ts`), so `sort` cannot change shape in
  place. The jb2hubs writer keeps emitting `hierarchical.sort` and
  `defaultCollapsed` for the v4.3.0 boot floor, so the lift stays forever.
  Land any rename before 5.0.0 final, which freezes slot paths (ADR-238).
- **A config `filter` can hide tracks.** A predicate using `gte`, `lt` or
  `valid` has no chip to show or clear it, which breaks ADR-271's "a filter
  is never hidden". Either limit the track-list filter to `oneOf`, or draw a
  chip for every predicate. The chip counts assume one entry per field, and a
  list allows repeats.
- **Saving a filter in a session** means moving `filters` out of volatile
  state (`TrackTable/trackTableModel.ts`).
