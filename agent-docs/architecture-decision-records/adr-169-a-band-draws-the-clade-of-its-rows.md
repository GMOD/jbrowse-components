---
status: Accepted
summary: "Bands of rows on the multi-sample variant displays (`facet`, a samples TSV column) and the multi-row feature display (`facet: 'group'`, from `rowGroups`) stack through one `TreeSidebarMixin` stage, `bandedSources`, and win over a cluster tree: a band draws the clade of `rows.tree` whose leaves are exactly its rows in order, and a band with none draws nothing, which the stale-tree hint counts. `rows.tree` holds one forest, a band tree per band under a root joining them at the tallest band's height, written by a clustering run under bands beside `rows.domain` in one `setRowOrder`; the config gains no member. The band trees share one depth scale, and each band is labelled up a strip in the margin beside the tree, culled where it is too short, on screen and in the SVG export alike. Retires \"a band yields while a tree describes the rows\", `maybeApplyFacet` and `rowGroups`' partition"
---

# ADR-169: A band draws the clade of its rows, and `rows.tree` holds one forest

## Status

Accepted (2026-09-25). Step 5 of
[one-row-model-for-displays-that-stack-by-a-key](../ideas/ready/one-row-model-for-displays-that-stack-by-a-key.md),
on Colin's answers to calls 6, 7 and 8 of the row-model handoff. Builds on
[ADR-157](adr-157-a-row-displays-arrangement-is-the-rows-config-object.md),
whose `rows.tree` this gives a second shape, and
[ADR-160](adr-160-a-rows-colour-is-one-categorical-channel-on-the-row-axis.md),
whose dealer deals over the unbanded rows, so a band recolours nothing.
[packages/tree-sidebar/CLAUDE.md](../../packages/tree-sidebar/CLAUDE.md)
§"A tree per band" is the operational doc.

## Context

Two displays stacked their rows in bands and each yielded the bands to a tree.
The multi-sample variant displays' `facet` sorted the rows by a samples TSV
column in `maybeApplyFacet` unless a cluster tree described them, and the
multi-row display's `rowGroups` partitioned its rows into blocks with the same
exception, written a second time in `applyRowGroups`. So a clustered cohort
could not be read by population: setting a facet over it did nothing, and
clearing the tree to band it lost the tree. ComplexHeatmap draws the picture a
reader wants, `row_split` with `cluster_rows`: the rows split into slices, each
slice clustered and drawing its own dendrogram.

## Decision

**One stage bands the rows.** `TreeSidebarMixin`'s `bandedSources` follows
`clusterableSources` over two hooks, `rowBanding` (the attribute and the bands
listed first) and `rowBand(row)`, and `bandRows` stacks the bands in `facet`'s
`domain` order, the rest sorted with the no-value band last, each band's rows
in their arranged order. `rows` comes back by reference while nothing bands. The
variant displays' banding is their `facet`; the multi-row display's is its new
`facet` slot, whose `group` reads the `rowGroups` entry a row's name matches,
the groups in the order `rowGroups` declares them after `domain`. `rowGroups`
now only tags.

**The bands win.** A band draws the clade of `rows.tree` whose leaves are
exactly its rows, in order, and a band with none draws nothing.
`matchBandClades` finds every band's clade in one post-order walk that labels
each node with the band its leaves share and their count. A band a sample
joins loses its own dendrogram alone, and moving the bands keeps every one; a
drag still writes `rows.domain` through `setRowOrder`, which drops the whole
tree as before. A whole-cohort tree under a facet set afterwards
draws in the bands that happen to be its clades, as ComplexHeatmap's does, and
the stale-tree hint says how many bands are left without one and to re-run
clustering.

**`rows.tree` holds one forest.** A run under two or more bands sends the
rows of each band (`clusterPartition`), `clusterMatrix` clusters each band
apart, and the tree is one newick whose root's children are the band trees,
joined at the tallest band's height so every leaf sits at one depth and the
forest drawn with no bands is a dendrogram. A one-row band is a bare leaf.
`rows.domain` is the leaves in turn, written by the same `setRowOrder`, so a run
is still one undo step and the config gains no member.

**One depth scale across the band trees**, as ComplexHeatmap draws slice
dendrograms: a band's farthest leaf meets the right edge and its root sits as
far in as its height, so a branch reads the same length in every band.
`bandForestLayout` places each clade on its band's rows under a root that
draws no link (`forestRoot`, which `treeLinks` and the hit index skip).

**The band's label is in the margin.** `SvgBandLabels` draws a strip beside the
tree, each band's name written up its rows where the band is tall enough to
hold it and culled where not: ggplot2's
`strip.position = "left"`, ComplexHeatmap's `row_title`. `RowLabelsOverlay` and
`SvgTreeSidebar` both draw it and move the row labels past it, so the SVG
export draws what the screen does. It has no hide control.

## Consequences

- A banded track changes on screen: the strip takes `BAND_LABEL_WIDTH` px beside
  the tree and the row labels move right by it. An unbanded track draws exactly
  what it did; the four row-derivation suites' unbanded snapshots are unchanged.
- A multi-row config that relied on `rowGroups` to stack its groups writes
  `facet: 'group'`, as `test_data/volvox`'s `volvox_mouse_inheritance_rows`
  and the Roadmap figure now do; the Roadmap figure's band order is the
  facet's `domain` rather than a re-sorted `rowGroups`.
- The variant colour key lists its values in the band order while the facet and
  `rowColor` read one attribute (`rowColorKeyOrder`), now whether or not a tree
  is drawn.
- A run under bands costs less than one over the cohort: 2,504 samples in 26
  bands is about 26 × 96² pair distances rather than 2,504².
- Wiggle's `facet: 'group'` stays declined (ADR-157's `checkRowsField`), and MAF
  and the mark display band nothing yet.

## Rejected alternatives

- **A tree per band in a map on the config** (`rows.trees` by band value). It
  couples `rows` to `facet`'s field, and reset, undo and the changes table all
  work per member; one forest in `rows.tree` needs none of that.
- **The band yielding to a whole-cohort tree**, today's rule. A facet set over
  a clustered cohort then does nothing a reader can see.
- **Chips over the data**, as the section displays label a facet. A 1000
  Genomes matrix by population is 26 chips over the cells; the margin already
  holds the tint strip the band's colour is read from.
- **Each band's dendrogram stretched to the full gutter**. Branch lengths would
  not compare across bands.
