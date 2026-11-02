---
id: rowtree
title: RowTree
description: "rows.tree, the dendrogram beside the rows: its newick, and where a clustering run computed it, the locus and settings it ran with. A string is the newick."
sidebar_label: Display setting -> RowTree
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/rowTreeConfigSchema.ts).

`rows.tree`, the dendrogram beside the rows: its newick, and where a
clustering run computed it, the locus and settings it ran with. A string is
the newick. Written whole, so a tree written without `provenance` drops the
one it replaces; a plot read gives the object whichever form was written.
Whether it draws is `rows.axis.tree`.

## Example usage

```js
{ type: 'LinearVariantDisplay', rows: { tree: '((HG002,HG003),HG004);' } }
```

## Config slots

A setting written to it replaces it whole: a member left out returns to its default. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-newick">**newick**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | The tree as newick, its leaves the row names. Writing `rows.tree: "(a,b);"` sets this slot. |
| <span id="slot-provenance">**provenance**</span><br>[`maybeFrozen`](/docs/config_guides/slot_types#the-maybe-types) | The locus and settings a clustering run computed the tree from; unset for a tree that arrived as data, which rotates towards `rows.sort`. |
