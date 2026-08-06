A whole-genome view is not a mode. It is the same view every other page here
builds, with 24 displayed regions instead of one.

## Getting the regions

`init.loc` is handed straight to `navToLocString`, and a locstring takes as many
regions as you give it — so `chr1 chr2 … chrX chrY` is the whole mechanism.
`init.displayedRegionNames` takes the same list as an array if you would rather
not join it.

What you probably want is **not** `view.showAllRegionsInAssembly()`. hg38 has
455 sequences in it, counting every `_alt`, `_random` and `chrUn_` scaffold, and
all but the 24 land sub-pixel and elide. Which sequences are "the chromosomes"
is a choice a human makes; no field in the file records it.

## The two bits of chrome you now need

Regions are laid out contiguously, so at this width the view is one continuous
strip unless you draw the boundaries yourself. `RegionBoundaries` is the same
component as on the Drive it from your app page — filter `view.staticBlocks` for
`isRightEndOfDisplayedRegion`, place a rule at
`block.offsetPx + block.widthPx - view.offsetPx`.

`RegionNames` is the same one the Scalebar page explains, and it is what turns
24 bands into chromosomes. It keeps the current region's label pinned to the
left edge as you pan past its start, and clamps each label to its own region
with `view.scalebarRegionEndPx` so a name never runs into its neighbour.

## Why the track still draws

A bigWig carries precomputed summaries, so phyloP across 3.1Gb is one cheap read
per region rather than a hopeless one. A track with no summary tier — a BAM, a
tabix GFF — will refuse this width instead, which is correct and not a bug.
