Both panels are driven by the same cell-type list: the UMAP's palette and the
track's subadapters are built from `cells.json`, so nothing is kept in sync by
hand.

Selecting cell types calls the display's own row filter — the one the track's
sidebar tree drives. Passing `undefined` clears it. Hidden rows drop out of the
shared score axis too, so filtering to two cell types rescales the plot to those
two:

```ts
const display = view.getTrack(TRACK_ID)
  ?.activeDisplay as MultiWiggleDisplayModel
display.setSubtreeFilter(['CD8 T', 'NK'])
```

The other direction needs no wiring: clicking a feature sets
`session.selection`, and an `observer` reading it re-renders the UMAP with that
gene's expression.

Coverage is 10x 3' data, so it piles at the 3' end of each gene and the height
of that pile is the cell type's expression — a marker gene reads as one tall row
against eight flat ones. The third track is the same reads unpooled, one row per
cell, from a Zarr matrix read by `MultiWiggleZarrAdapter` (an external plugin,
loaded by URL alongside the data). Its axis is **pinned rather than
autoscaled**: against the home cell type's maximum every single-UMI cell renders
white, and pinning a low `maxScore` is what makes the ambient-RNA speckle
visible.

Built by
[`build_scrna_pseudobulk.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_scrna_pseudobulk.sh)
— see the
[scRNA pseudobulk tutorial](https://jbrowse.org/jb2/docs/tutorials/scrna_pseudobulk/).
