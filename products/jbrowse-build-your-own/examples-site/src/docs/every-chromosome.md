A whole-genome view is the same view every other page builds, just with 24
displayed regions instead of one. `init.loc` is handed straight to
`navToLocString`, and a locstring takes as many regions as you give it, so
`chr1 chr2 … chrX chrY` is the whole mechanism. `init.displayedRegionNames`
takes the same list as an array.

Avoid `view.showAllRegionsInAssembly()`. hg38 has 455 sequences counting every
`_alt`, `_random` and `chrUn_` scaffold, and all but the 24 land sub-pixel and
elide. Which sequences are "the chromosomes" is a choice a human makes. No field
in the file records it.

Regions lay out contiguously, so this is one continuous strip unless you draw
the boundaries. `RegionBoundaries` and `RegionNames` are the components the
[section above](#drive-it-from-your-app) and the
[scalebar](../scalebar-and-labels/#scalebar) explain. Both read geometry the
view already computed, rather than deriving it from block flags, which is how
the narrowest bands end up with no name at all instead of an ambiguous `2…`.

The track still draws because a bigWig carries precomputed summaries. A track
with no summary tier (a BAM, a tabix GFF) refuses this width instead, which is
correct and not a bug.
