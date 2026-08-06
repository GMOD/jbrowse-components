A space-separated multi-region locstring in `init.loc` shows several regions at
once:

```js
init: {
  loc: 'chr1:113073119..113073695 chr1:113091267..113091433'
}
```

The **Flip** button calls `view.horizontallyFlip()`, and an `observer` reading
`view.displayedRegions[0].reversed` keeps its label in sync. Multi-region views
are the building block for gene-centric layouts and synteny ribbons.

See [horizontally flip](../flipping-regions/#horizontally-flip) for the
single-region cases.
