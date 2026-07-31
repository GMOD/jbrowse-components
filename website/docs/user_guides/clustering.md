---
title: Clustering rows
description:
  Reorder a multi-row track's rows by similarity, read the dendrogram, and
  filter to a clade
guide_category: Analysis
---

**TL;DR:** Several track types stack one row per sample, and each can reorder
those rows by similarity rather than file order, drawing a dendrogram beside
them. The **Clustering** submenu in the track menu is the same on all of them,
and only the item that runs it differs, because it names what is being
clustered.

| Track type                                                      | Runs it with                | Clusters on                    |
| --------------------------------------------------------------- | --------------------------- | ------------------------------ |
| [Multi-sample variant](/docs/user_guides/multivariant_track)    | Cluster rows by genotype... | per-sample genotypes           |
| [Multi-quantitative](/docs/user_guides/multiquantitative_track) | Cluster rows by score...    | each subtrack's signal profile |
| [Multi-row feature](/docs/user_guides/multirow_feature_track)   | Cluster rows by similarity  | each row's painted intervals   |

Clustering reads **only the region currently in view**, so navigate to an
informative locus before running it. A region with no discriminating signal
produces no useful separation.

## Auto and manual modes

The variant and multi-quantitative displays open a dialog with two modes:

- **Auto** runs hierarchical clustering (hclust, compiled to WebAssembly) in a
  worker, reporting progress as it goes. This is the mode to use.
- **Manual** is an escape hatch for doing the clustering elsewhere. It hands you
  the matrix, either as an R script that runs `hclust` and prints the row order,
  or as a plain TSV for any other tool. Paste the resulting order back into the
  dialog and click **Apply clustering**.

Both modes cluster the same rows with the same linkage by default (average, or
UPGMA), so manual mode reproduces auto mode rather than quietly returning a
different tree.

The multi-row feature display runs in the browser without a dialog.

## Reading and using the dendrogram

After a run, rows are reordered so similar rows sit together and a dendrogram is
drawn in the sidebar.

- **Show tree** toggles the dendrogram. It stays disabled until clustering has
  been run. The multi-row feature display is the exception: its sidebar carries
  the row labels as well as the tree, which is useful with no clustering at all,
  so it has **Show... → Show sidebar with tree and labels** instead.
- The **Clustering** submenu can also draw the tree with **branch lengths**, so
  the horizontal extent of each branch reflects distance rather than nesting
  alone.
- Click any internal node to filter the track down to that clade. Click it again
  to clear, or use **Clear subtree filter**.

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
