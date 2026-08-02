# RenderAlignmentDataRPC

One RPC serves pileup and chain, branching on `args.linkedReads`.

## Row-instanced vs position-aggregate

Row-instanced features (read, gap, mismatch, clips, modification, per-base)
carry `*Ys` and are packed on the **main thread** at upload, because a read's
row isn't known until all visible regions are laid out together.
Position-aggregate features (coverage, snpCoverage, interbase, indicator) are
row-independent, so the worker packs them once and the main thread uploads the
bytes verbatim. `uploadReads` runs first — it creates the region entry the
others read back.

## Group-by

`chainGroupingKey` is the single source of truth for by-name grouping. It
returns the QNAME for primary/supplementary but a **unique synthetic key for
secondary alignments**, so a multimapper never joins its primary's chain.

**Keep every dimension a closed set; `MAX_GROUPS` is only the backstop.** Each
group allocates region-width depth arrays and its own GPU coverage buffer, so a
high-cardinality tag pays that per distinct value. `mapq` bins by confidence,
not by decade, because real MAPQ is bimodal at the aligner's ceiling. `tag` is
the one the data decides, so the dialog blocks Submit and names the count. The
`''` untagged group is held out of the overflow merge — reads _lacking_ the tag
are a distinct answer users look for.

Chain mode allows only dimensions where every read of a chain yields the same
key, driven by the `chainConsistent` flag both the worker guard and the dialog
read. Adding a `GroupByType` member is a compile error until it's classified.

Key generators must cover **both** worlds this pipeline serves, since
LGVSyntenyDisplay pushes PAF blocks through it — hence `strand` over
`SAM_FLAG_REVERSE`, and `getMappingQuality` (BAM spells it `score`, PAF
`mappingQual`).

Chain numbering is **per worker call**, so anything unioning chains across calls
keys by chain **name**, not chainIdx.

## The placement axis is segmented per refName — in BOTH layouts

RefNames share a coordinate space but occupy disjoint screen space, so one axis
collides regions that never overlap. Pileup shifts each read's unioned extent as
a unit; chain shifts each region's bounds **before** merging by name, because a
chain can span refNames. Chain had this bug after pileup's was fixed — keep
both.

`sortedBy` applies **only when every displayed region shares one refName**, so a
localized sort can't false-match a position on another chromosome.

`showSoftClipping` belongs in `rpcProps` — the worker gates per-base extraction
on it.
