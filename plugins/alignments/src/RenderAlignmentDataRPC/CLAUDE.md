# RenderAlignmentDataRPC

One RPC serves pileup and chain, branching on `args.linkedReads`.

## Row-instanced vs position-aggregate

Row-instanced features (read, gap, mismatch, clips, modification, per-base)
carry `*Ys` and are packed on the **main thread** at upload, because a read's
row isn't known until all visible regions are laid out together
([ADR-053](../../../../agent-docs/architecture-decision-records/adr-053-alignments-layout-stays-on-the-main-thread.md)
— don't move layout here to make them worker-packable; the pack is separable
from the layout and the ADR says how). Position-aggregate features (coverage,
snpCoverage, interbase, indicator) are row-independent, so the worker packs them
once and the main thread uploads the bytes verbatim.

The renderer's per-region metadata (`regionMeta`) is derived separately from the
uploads rather than as a side effect of one of them, because a region whose
payload is unchanged still needs the metadata while skipping every pack — see
GPU_RENDERING.md §"Whole-map synced".

## Group-by

`chainGroupingKey` is the single source of truth for by-name grouping. It
returns the QNAME for primary/supplementary but a **unique synthetic key for
secondary alignments**, so a multimapper never joins its primary's chain — and
for a feature with **no name at all**, which is not a SAM case: a PAF/synteny
block carries no QNAME, and keyed by the empty one every block in the region
became a single chain the moment `linkedReads` was set on LGVSyntenyDisplay.
`groupReadsByName` (both twins) skips a nameless read for the same reason.

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

## A fixture builds on `testPileupData`, never `as unknown as`

`PileupDataResult` has 103 required fields, so no test sets them all and the
cast looked free. It is not: it turns off excess-property checking, so a
misspelled field name is accepted in silence, and it lets a fixture omit a field
production code later starts reading — which is how `readInterchrom` broke two
suites at once. `basePileupDataResult(n)` supplies the required set and nothing
else; `makePileupDataResult(overrides)` sizes it from whichever per-read array
you pass.

The optional fields are left out **on purpose** — they are what `isChainData`
narrows on and what the `?. ?? default` readers fall back from, so a base that
filled them would move tests to the other branch without saying so.

## The placement axis is segmented per refName — in BOTH layouts

RefNames share a coordinate space but occupy disjoint screen space, so one axis
collides regions that never overlap. Pileup shifts each read's unioned extent as
a unit; chain shifts each region's bounds **before** merging by name, because a
chain can span refNames. Chain had this bug after pileup's was fixed — keep
both.

## `sortedBy` names a column, not an offset — `sortForRegions` is the gate

It applies **only when every region being laid out is on `sortedBy.refName`**,
so a localized sort can't false-match the same number on another chromosome.

Both layout paths call `sortForRegions`, and that is the point: the gate lived
in the multi-region path alone, while the single-region path — one region on
screen, i.e. most browsing — passed `sortedBy` straight through. The slot is
**config**, so it outlives the contig it was set on: sort at chr1:1000, navigate
to chr2, and chr2's reads were reordered by whatever sat at chr2:1000, silently
and with the menu correctly still showing a sort as active.

It is also what the display's `sortedBy` getter promises. That getter
canonicalizes the refName because a session spec can carry an alias, and says an
unresolvable one leaves the reads _unsorted_ — which needs a gate on every path,
not just the multi-region one.

The multi-region path keeps its own `regions &&` check on top. That one is
structural, not policy: it needs the bounds to find the region holding the sort
position at all.

`showSoftClipping` belongs in `rpcProps` — the worker gates per-base extraction
on it.
