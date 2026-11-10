---
name: a-row-listing-carries-its-rows-attributes
description: A mark display over a multi-BigWig cannot facet, filter or color its rows by a subtrack's `group` or a samples table column, because an adapter's row listing carries only name, label and color. Read before adding a row attribute source.
---

# A row listing carries its rows' attributes

Every row display reads a row attribute by one rule, `rowFieldValue` in
`packages/tree-sidebar/src/rowColorScale.ts`, and the adapters already share
one attribute file: `samplesTsvLocation` is on the VCF adapters,
`MultiWiggleAdapter` and MAF, and on a multi-BigWig its columns override the
subadapter's own fields row by row. What differs is how far the attributes
travel.

- `ListedRowSource` (`packages/core/src/data_adapters/BaseAdapter/rowSources.ts`)
  holds `name`, `label` and `color`, so `MultiWiggleAdapter.listRowSources`
  drops `group` and every samples table column. The mark family reads the
  listing, so `facet: 'group'`, `rows.filter` and `rows.color` over those
  attributes read nothing there, where the wiggle display over the same
  adapter reads them.
- The VCF adapters list no rows, so a mark display over a VCF sees none of its
  samples table.

The change is the listing carrying each row's attributes and the mark family
spreading them onto its rows before `rows.groups` tags `group`.

## Declined with it

A `rows.data` table in config, each column a map by row name or a list of
`{ match, value }` regexes, was reviewed on 2026-11-09 and dropped. A map by
row name has to clear when `rows.field` changes and a regex list has to
survive it (ADR-257's write rule), so one member cannot hold both, and the
samples table already is the per-row table. `rows.groups` on the variant
display stays in ADR-257's Parked list.
