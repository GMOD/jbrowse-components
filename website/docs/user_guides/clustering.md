---
title: Clustering rows
description:
  Reorder a multi-row track's rows by similarity, read the dendrogram, and
  filter to a subtree
guide_category: Analysis
---

**TL;DR:** Several track types stack one row per sample, and each can reorder
those rows by similarity, drawing a dendrogram beside them. The **Clustering**
submenu in the track menu is the same on all of them; only the item that runs it
differs, naming what is being clustered.

| Track type                                                      | Runs it with                | Clusters on                    |
| --------------------------------------------------------------- | --------------------------- | ------------------------------ |
| [Multi-sample variant](/docs/user_guides/multivariant_track)    | Cluster rows by genotype... | per-sample genotypes           |
| [Multi-quantitative](/docs/user_guides/multiquantitative_track) | Cluster rows by score...    | each subtrack's signal profile |
| [Multi-row feature](/docs/user_guides/multirow_feature_track)   | Cluster rows by similarity  | each row's painted intervals   |

<Video src="/media/pangenome/hprc_cluster_callset.mp4" caption="Cluster rows by genotype on a multi-sample variant track: the rows arrive in the callset's own order, and the run reorders them and draws the dendrogram beside them." />

Clustering reads **only the region currently in view**, so it describes one
window: a clustered painting is genome-wide relatedness only when the view is
the whole genome. After a run, the locus the tree was computed from is shown
beside the dendrogram and travels with an SVG export, so a figure carries its
own scope.

Hierarchical clustering returns a fully resolved tree for any input, including
one with no structure in it, so re-running across loci until the rows separate
as expected selects a window rather than establishing a grouping. A grouping
found that way is a hypothesis to check on independent data.

## What the dendrogram measures

The dendrogram summarizes similarity over the visible window. It is not a
phylogeny: no evolutionary model is fitted, branch lengths are merge distances,
and no support values are computed, so a crisply drawn group is not a
well-supported one. A [](/docs/user_guides/maf_track) can show a real phylogeny,
read from an `.nh` file; that tree carries no locus caption, which distinguishes
the two on screen.

For genotype data the window matters in one more way. A tree asks for a single
distance summarizing the whole window, and a haplotype is a mosaic of segments
with different histories, so past the first recombination breakpoint a
window-averaged distance describes no position in particular. The multi-sample
variant display's **Sort by genotype** (right-click a variant) answers that
question directly: it orders rows by their allele at that variant and then by
how far they agree outward, so the shared block reads as a solid rectangle and
frays exactly where recombination ends it.

## Auto and manual modes

The variant and multi-quantitative displays open a dialog with two modes:

- **Auto** runs hierarchical clustering (hclust, compiled to WebAssembly) in a
  worker, reporting progress as it goes. This is the mode to use.
- **Manual** is an escape hatch for doing the clustering elsewhere. It hands you
  the matrix, either as an R script that runs `hclust` and prints the row order,
  or as a plain TSV for any other tool. Paste the resulting order back into the
  dialog and click **Apply clustering**.

Both modes cluster the same rows with the same linkage by default (average, or
UPGMA), so manual mode reproduces auto mode.

The multi-row feature display runs in the browser without a dialog. It clusters
on the color each row is painted, so the coloring is an input: change **Color
by...** and the same rows over the same locus give a different tree. The
coloring in force is recorded in the caption alongside the locus. A painting
with a handful of distinct colors is treated as categorical, and distance is
then the number of bins whose colors differ; a palette with many colors is
treated as continuous, and rows painted similar shades land closer together.

## Reading and using the dendrogram

After a run, rows are reordered so similar rows sit together and a dendrogram is
drawn in the sidebar.

- **Show tree** toggles the dendrogram. It stays disabled until clustering has
  been run. The multi-row feature display's sidebar carries the row labels as
  well as the tree, useful with no clustering run, so it has **Show... → Show
  sidebar with tree and labels** instead.
- The **Clustering** submenu can also draw the tree with **branch lengths**, so
  the horizontal extent of each branch reflects distance.
- Click any internal node to filter the track down to that subtree. Click it
  again to clear, or use **Clear subtree filter**.
- A chip at the top of the sidebar names the locus the tree was computed from.
  Navigating away from that region marks it, since the tree describes the region
  it was run on. Re-run clustering, or reset the row order, to bring the two
  back together.

## Encoding a clustering result in a session URL

A finished clustering can be embedded in a session snapshot, which is how a
pre-computed result travels through a shared link. Set `layout` and
`clusterTree` (and optionally `treeAreaWidth` / `subtreeFilter`) in the
display's `displaySnapshot`, described under
[URL parameters → advanced track configuration](/docs/urlparams#advanced-track-configuration).

The per-display field references are
[](/docs/models/multisamplevariantbasemodel) and
[](/docs/config/multilinearwiggledisplay).

## See also

- [](/docs/user_guides/multivariant_track)
- [](/docs/user_guides/multiquantitative_track)
- [](/docs/user_guides/multirow_feature_track)
- [](/docs/user_guides/maf_track)
