The two panels are driven by the same cell-type list, so nothing has to be kept
in sync by hand: the UMAP's palette and the track's subadapters are both built
from `cells.json`.

Selecting cell types calls the display's own row filter, the one the track's
sidebar tree drives:

```ts
const display = view.getTrack(TRACK_ID)
  ?.activeDisplay as MultiWiggleDisplayModel
display.setSubtreeFilter(['CD8 T', 'NK'])
```

Passing `undefined` clears it. Hidden rows are dropped from the shared score
axis too, so filtering to two cell types rescales the plot to those two rather
than leaving them short against a maximum set by a row you can no longer see.

The other direction needs no wiring at all. Clicking a feature sets
`session.selection`, and an `observer` reading it re-renders the UMAP with that
gene's expression:

```ts
const clicked = isFeature(selection) ? String(selection.get('name')) : undefined
```

Coverage is 10x 3' data, so it piles up at the 3' end of each gene rather than
spreading across the gene body. The height of that pile is the cell type's
expression, which is why a marker gene reads as one tall row against eight flat
ones.

The third track is the same reads without the pooling: one row per cell, 4390 of
them, from a Zarr matrix the `MultiWiggleZarrAdapter` reads. That adapter comes
from an external plugin, loaded by URL alongside the data:

```ts
loadPlugins([{ name: 'Zarr', url: ZARR_PLUGIN }]).then(loaded =>
  loaded.map(p => p.plugin),
)
```

Its score axis is pinned rather than autoscaled. The maximum in view is whatever
the home cell type reached, hundreds of UMIs in one monocyte at LYZ, and against
that every single-UMI cell renders white. Pinning a low `maxScore` is what makes
the speckle in the other blocks visible, and that speckle is ambient RNA, which
the pooled row above draws as a low flat line. The genes in the first dropdown
group are the marker windows the matrix covers.

The cells, the palette, the per-gene expression panel, and the BigWigs are all
built by
[`build_scrna_pseudobulk.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_scrna_pseudobulk.sh),
which is documented in the
[single-cell RNA pseudobulk tutorial](https://jbrowse.org/jb2/docs/tutorials/scrna_pseudobulk/).

Reference:
[MultiWiggleAdapter](https://jbrowse.org/jb2/docs/config/multiwiggleadapter/),
[MultiLinearWiggleDisplay](https://jbrowse.org/jb2/docs/config/multilinearwiggledisplay/),
and [](https://jbrowse.org/jb2/docs/tutorials/scatac_pseudobulk/) for the same
pattern on single-cell ATAC.
