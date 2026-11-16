---
title: Clustering rows
description:
  Reorder a multi-row track's rows by similarity, read the dendrogram, and
  filter to a subtree
guide_category: Analysis
---

Several track types stack one row per sample, and each can reorder those rows by
similarity, drawing a dendrogram beside them. The **Clustering** submenu in the
track menu is the same on all of them; only the item that runs it differs,
naming what is being clustered.

| Track type                                                    | Runs it with                  | Clusters on                  |
| ------------------------------------------------------------- | ----------------------------- | ---------------------------- |
| [Multi-sample variant](/docs/user_guides/multivariant_track)  | Cluster rows by genotype...   | per-sample genotypes         |
| [Quantitative](/docs/user_guides/quantitative_track)          | Cluster rows by score...      | each source's signal profile |
| [Multi-row feature](/docs/user_guides/multirow_feature_track) | Cluster rows by similarity... | a feature attribute per bin  |

<Video src="/media/pangenome/hprc_cluster_callset.mp4" caption="Cluster rows by genotype on a multi-sample variant track, which reorders the rows and draws a dendrogram." />

Clustering reads **only the region currently in view**, so a clustered painting
is genome-wide relatedness only when the view is the whole genome. After a run,
the locus the tree was computed from is shown beside the dendrogram and in an
SVG export.

Hierarchical clustering returns a fully resolved tree for any input, including
one with no structure in it, so a grouping found by re-running across loci until
the rows separate is a hypothesis to check on independent data.

## What the dendrogram measures

The dendrogram summarizes similarity over the visible window, and is not a
phylogeny:

- **No model:** no evolutionary model is fitted, and branch lengths are merge
  distances
- **No support values:** a crisply drawn group is not a well-supported one
- **A real phylogeny:** a [](/docs/user_guides/maf_track) draws one, read from
  an `.nh` file, with no locus caption beside it

On genotype data a haplotype is a mosaic of segments with different histories,
so past the first recombination breakpoint a window-averaged distance describes
no position in particular. **Sort rows by genotype here**, from a variant's
right-click menu on a multi-sample variant track, orders rows by their allele at
that variant and then by how far they agree outward, so the shared block reads
as a solid rectangle and frays where recombination ends it.

## Auto and manual modes

Every display opens the same dialog, with two modes:

- **Auto** runs hierarchical clustering (hclust, compiled to WebAssembly) in a
  worker, reporting progress as it goes; it is the usual choice.
- **Manual** is for clustering outside JBrowse: it exports the matrix, either as
  an R script that runs `hclust` and prints the row order, or as a plain TSV for
  any other tool. Paste the resulting order back into the dialog and click
  **Apply clustering**.

Both modes cluster the same rows with the same linkage by default (average, or
UPGMA), so manual mode reproduces auto mode.

The multi-row feature display clusters on what colors its blocks, binned across
the window: the color's field, or each feature's own color. A numeric field is
averaged per bin and rows with similar values land closer together; any other
color is categorical, compared bin by bin. Under one color for everything, the
display clusters on which bins each row covers at all.

## Reading and using the dendrogram

<Figure src="/img/clustering/kept_rows.png" caption="A multi-sample variant track narrowed to a few samples and clustered: the dendrogram beside their rows, and the chip counting the rows shown." />

- **Show → Show tree** toggles the dendrogram. It stays disabled until
  clustering has been run; the row labels have a separate toggle beside it.
- **Show → Show tree branch lengths** draws the tree with branch lengths, so the
  horizontal extent of each branch reflects distance.
- Click any internal node and pick **Show only subtree** to filter the track
  down to it; **Show all rows** in the same menu, or the chip above the rows,
  shows every row again.
- A chip at the top of the sidebar names the locus the tree was computed from.
  Navigating away from that region marks it; re-run clustering, or reset the row
  order, to bring the two back together.
- On a track banded by `facet` (a multi-sample variant track's samples column,
  or a multi-row track's `group`), clustering runs within each band and draws a
  dendrogram per band, all on one depth scale. A tree run before the bands were
  set draws only in the bands that happen to be one of its clades, and the chip
  counts the bands left without one until clustering runs again.

## Encoding a clustering result in a session URL

A finished clustering can be embedded in a session snapshot, which is how a
pre-computed result travels through a shared link. Where it goes depends on the
display.

On a quantitative track the order, tree and focus are the display's
[`rows`](/docs/config/linearwiggledisplay/#slot-rows) setting, written on the
track entry the way
[URL parameters → advanced track configuration](/docs/urlparams#advanced-track-configuration)
describes. `rows` replaces the display's setting whole, so name `field` too:

```json
{
  "trackId": "my_multiwig",
  "rows": {
    "field": "source",
    "sort": ["s2", "s1", "s3"],
    "tree": "((s2,s1),s3);"
  }
}
```

Two more members pick which rows show:

- **`kept`** opens on one clade, by the rows' own names. A `kept` naming no
  current row shows none, and the track's notice lists the names it missed
- **`filter`** keeps rows by an attribute instead, a samples file's column or a
  subtrack's `group`:
  `"filter": [{ "field": "population", "oneOf": ["EUR", "AFR"] }]`

On a multi-sample variant track the rows are the samples, so its
[`rows`](/docs/config/rowarrangement) takes the same members with no `field`. In
phased mode the names are haplotypes, `"<sample> HP<n>"`:

```json
{
  "trackId": "my_vcf",
  "rows": {
    "sort": ["HG002", "HG001", "HG003"],
    "tree": "((HG002,HG001),HG003);"
  }
}
```

A multi-row feature track's `rows` names its partition `field` beside the same
members, `{ "field": "sample", "sort": [...], "tree": "..." }`. A MAF track's
rows are its species, so its `rows` takes the variant display's members, and a
`tree` there replaces the adapter's guide tree.

The per-display field references are [](/docs/models/linearvariantdisplay) and
[](/docs/config/linearwiggledisplay).

## See also

- [](/docs/user_guides/multivariant_track)
- [](/docs/user_guides/quantitative_track)
- [](/docs/user_guides/multirow_feature_track)
- [](/docs/user_guides/maf_track)
