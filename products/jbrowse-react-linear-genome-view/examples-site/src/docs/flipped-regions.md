`horizontallyFlip()` swaps the regions' order and flips each one's `reversed`,
so there is no single flipped flag to read back: here
`displayedRegions[0].reversed` is `false` before and after.
