A linear genome view can show several regions at once — pass a space-separated
multi-region locstring to `init.loc`:

```js
init: {
  assembly: 'GRCh38',
  loc: 'chr1:113073119..113073695 chr1:113091267..113091433',
  tracks: ['ncbi-refseq-genes'],
}
```

This example pairs that with an external **Flip** button that toggles
orientation via `view.horizontallyFlip()`. An `observer`-wrapped component reads
`view.displayedRegions[0].reversed` to label the button, so the UI stays in sync
with the view's actual state. Multi-region views are the building block for
gene-centric layouts and synteny ribbons.

See [horizontally flip the view](../flipping-regions/#horizontally-flip) for the
single-region cases, and the
[LinearGenomeView state model](https://jbrowse.org/jb2/docs/models/lineargenomeview/)
for `displayedRegions` and the other view properties read here.
