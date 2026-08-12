A space-separated multi-region locstring in `init.loc` shows several regions at
once.

Orientation is per region — a `[rev]` suffix reverse-complements just that one,
so the regions on screen can differ. `view.horizontallyFlip()` reverses the
whole arrangement: the regions swap order _and_ each flips its own `reversed`,
which is why there is no single "is it flipped" flag to read back — on these two
regions `displayedRegions[0].reversed` is `false` before the click and `false`
after it. Watch the scalebar instead. Multi-region views are the building block
for gene-centric layouts and synteny ribbons.

See [horizontally flip](../flipping-regions/#horizontally-flip) for the
single-region cases.
