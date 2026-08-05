Both panels are driven by the same cell-type list: the UMAP's palette and the
track's subadapters are built from `cells.json`, so nothing is kept in sync by
hand.

Selecting cell types calls the display's own row filter, the one the track's
sidebar tree drives:

```ts
const display = view.getTrack(TRACK_ID)
  ?.activeDisplay as MultiWiggleDisplayModel
display.setSubtreeFilter(['CD8 T', 'NK'])
```

Passing `undefined` clears it. Hidden rows drop out of the shared score axis
too, so filtering to two cell types rescales the plot to those two.

The other direction needs no wiring. Clicking a feature sets `session.selection`
and an `observer` reading it re-renders the UMAP with that gene's expression:

```ts
const clicked = isFeature(selection) ? String(selection.get('name')) : undefined
```

Coverage is 10x 3' data, so it piles up at the 3' end of each gene, and the
height of that pile is the cell type's expression — a marker gene reads as one
tall row against eight flat ones.

The third track is the same reads unpooled, one row per cell, from a Zarr matrix
read by `MultiWiggleZarrAdapter`. That adapter comes from an external plugin,
loaded by URL alongside the data:

```ts
loadPlugins([{ name: 'Zarr', url: ZARR_PLUGIN }]).then(loaded =>
  loaded.map(p => p.plugin),
)
```

Its score axis is pinned rather than autoscaled: the maximum in view is whatever
the home cell type reached, and against that every single-UMI cell renders
white. Pinning a low `maxScore` is what makes the ambient-RNA speckle in the
other blocks visible.

The cells, palette, expression panel and BigWigs are built by
[`build_scrna_pseudobulk.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_scrna_pseudobulk.sh),
documented in the
[single-cell RNA pseudobulk tutorial](https://jbrowse.org/jb2/docs/tutorials/scrna_pseudobulk/).

Reference:
[MultiWiggleAdapter](https://jbrowse.org/jb2/docs/config/multiwiggleadapter/),
[MultiLinearWiggleDisplay](https://jbrowse.org/jb2/docs/config/multilinearwiggledisplay/),
and the
[single-cell ATAC tutorial](https://jbrowse.org/jb2/docs/tutorials/scatac_pseudobulk/)
for the same pattern on scATAC.
