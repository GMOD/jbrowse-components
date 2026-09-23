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

<Video src="/media/pangenome/hprc_cluster_callset.mp4" caption="Cluster rows by genotype on a multi-sample variant track: the rows start in callset order, and clustering reorders them and draws the dendrogram beside them." />

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
variant display's **Sort rows by genotype here** (right-click a variant) answers
that question directly: it orders rows by their allele at that variant and then
by how far they agree outward, so the shared block reads as a solid rectangle
and frays exactly where recombination ends it.

## Auto and manual modes

Every display opens the same dialog, with two modes:

- **Auto** runs hierarchical clustering (hclust, compiled to WebAssembly) in a
  worker, reporting progress as it goes. This is the mode to use.
- **Manual** is for clustering outside JBrowse: it exports the matrix, either as
  an R script that runs `hclust` and prints the row order, or as a plain TSV for
  any other tool. Paste the resulting order back into the dialog and click
  **Apply clustering**.

Both modes cluster the same rows with the same linkage by default (average, or
UPGMA), so manual mode reproduces auto mode.

The multi-row feature display clusters on a feature attribute, binned across the
window: **Cluster on** in the dialog's advanced options picks which one, and the
caption records it alongside the locus. By default the display follows the
coloring — the attribute a `jexl:` color expression reads, else the feature
name. A numeric attribute is averaged per bin and rows with similar values land
closer together; any other attribute is categorical, and distance is the number
of bins whose values differ. **Presence only** drops the values and clusters on
which bins each row covers at all.

## Reading and using the dendrogram

After a run, rows are reordered so similar rows sit together and a dendrogram is
drawn in the sidebar.

- **Show... → Show tree** toggles the dendrogram. It stays disabled until
  clustering has been run; the row labels have their own toggle beside it.
- **Show... → Tree branch lengths** draws the tree with branch lengths, so the
  horizontal extent of each branch reflects distance.
- Click any internal node to filter the track down to that subtree. Click it
  again to clear, or use **Clear subtree filter**.
- A chip at the top of the sidebar names the locus the tree was computed from.
  Navigating away from that region marks it, since the tree describes the region
  it was run on. Re-run clustering, or reset the row order, to bring the two
  back together.

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
    "domain": ["s2", "s1", "s3"],
    "tree": "((s2,s1),s3);"
  }
}
```

Add `kept` to open on one clade. On a multi-sample variant track the rows are
the samples, so its [`rows`](/docs/config/rowarrangement) takes the same members
with no `field`. In phased mode the names are haplotypes, `"<sample> HP<n>"`:

```json
{
  "trackId": "my_vcf",
  "rows": {
    "domain": ["HG002", "HG001", "HG003"],
    "tree": "((HG002,HG001),HG003);"
  }
}
```

On the multi-row feature and MAF displays, set `layout` and `clusterTree` (and
optionally `subtreeFilter`) in the display's `displaySnapshot` instead.

The per-display field references are
[](/docs/models/multisamplevariantbasemodel) and
[](/docs/config/linearwiggledisplay).

## See also

- [](/docs/user_guides/multivariant_track)
- [](/docs/user_guides/quantitative_track)
- [](/docs/user_guides/multirow_feature_track)
- [](/docs/user_guides/maf_track)
