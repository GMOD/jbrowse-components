A whole-genome view is not a mode. It is the same view every other page here
builds, with 24 displayed regions instead of one.

`init.loc` is handed straight to `navToLocString`, and a locstring takes as many
regions as you give it — so `chr1 chr2 … chrX chrY` is the whole mechanism.
`init.displayedRegionNames` takes the same list as an array.

What you probably want is **not** `view.showAllRegionsInAssembly()`. hg38 has
455 sequences in it counting every `_alt`, `_random` and `chrUn_` scaffold, and
all but the 24 land sub-pixel and elide. Which sequences are "the chromosomes"
is a choice a human makes; no field in the file records it.

Regions lay out contiguously, so at this width the view is one continuous strip
unless you draw the boundaries. `RegionBoundaries` is the component from
[Drive it from your app](../drive-it-from-your-app/#drive-it-from-your-app);
`RegionNames` is the one the [scalebar page](../a-scalebar-not-a-ruler/)
explains, and it is what turns 24 bands into chromosomes.

The track still draws because a bigWig carries precomputed summaries, so phyloP
across 3.1Gb is one cheap read per region. A track with no summary tier — a BAM,
a tabix GFF — refuses this width instead, which is correct and not a bug.
