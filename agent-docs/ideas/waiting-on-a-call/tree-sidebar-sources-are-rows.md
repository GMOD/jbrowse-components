---
name: tree-sidebar-sources-are-rows
description: The tree-sidebar mixin calls its rows "sources" (`sources`, `bandedSources`, `clusterableSources`, `editableSources`, `RowSource`), the root of the row/source vagueness every row display inherits. Renaming them to "rows" is about 70 files; the call is the target names, since `bandedRows` and `expandedRows` already exist with other meanings.
---

# The tree sidebar's sources are rows

`TreeSidebarMixin` (packages/tree-sidebar) names the drawn rows `sources`,
and the stages before them `editableSources`, `clusterableSources` and
`bandedSources`; the row type is `RowSource`. A "source" was a subtrack when
the mixin served multi-wiggle alone. Now a row is a sample, a haplotype, a
MAF species or a mark display's `rows.field` value, so the word says less
than "row" and collides with wiggle's own sources, which a row display may
stack one per row or overlay onto one.

## Scope

On 2026-11-02 the four getters and `RowSource` appear in about 70 TS files:
tree-sidebar 21, maf 15, variants 13, marks 9, wiggle 9, display-test-utils 2.
tree-sidebar is not a served package, so no deprecated alias is owed, but a
plugin display composing the mixin reads these members.

## The call

The obvious spellings are taken. `bandedRows` is the `{ rows, bands }` pass
`bandedSources` reads, and `expandedRows` is the haplotype-expanded list
before the filter. A rename has to pick names for the stages, say
`editableRows`, `clusterableRows`, `stackedRows` and `drawnRows`, and rename
`bandedRows` out of the way, before the sweep is mechanical. wiggle's
`numSources` and its subtrack "sources" stay, since those are sources.
