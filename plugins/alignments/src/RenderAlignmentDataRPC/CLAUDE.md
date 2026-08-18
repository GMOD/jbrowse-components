# RenderAlignmentDataRPC

One RPC serves pileup and chain, branching on `args.linkedReads`.

## Row-instanced vs position-aggregate

Row-instanced features carry `*Ys` and are packed on the **main thread** at
upload, because a read's row isn't known until all visible regions are laid out
together
([ADR-053](../../../../agent-docs/architecture-decision-records/adr-053-alignments-layout-stays-on-the-main-thread.md)
— the pack is separable from the layout, and the ADR says how).
Position-aggregate features are row-independent, so the worker packs them once
and the main thread uploads the bytes verbatim.

`regionMeta` is derived separately from the uploads rather than as a side effect
of one, because a region whose payload is unchanged still needs the metadata
while skipping every pack.

## Group-by

`chainGroupingKey` is the single source of truth for by-name grouping. It
returns a **unique synthetic key for secondary alignments**, so a multimapper
never joins its primary's chain, and for a feature with **no name at all** — a
PAF/synteny block, which keyed by the empty name made every block in the region
one chain the moment `linkedReads` was set. `groupReadsByName` skips a nameless
read likewise.

- **Keep every dimension a closed set; `MAX_GROUPS` is only the backstop.** Each
  group allocates region-width depth arrays and its own GPU coverage buffer.
- `mapq` bins by confidence, not by decade — real MAPQ is bimodal at the
  aligner's ceiling.
- `tag` is the one the data decides, so the dialog blocks Submit and names the
  count. The `''` untagged group is held out of the overflow merge — reads
  _lacking_ the tag are a distinct answer users look for.
- Chain mode allows only dimensions that resolve one chain to one key —
  `fragmentLevel` (the chain's representative read answers for the fragment)
  **or** a `chainKey` that answers for the whole chain, which is why
  `isChainGroupableType` derives the answer instead of reading a third field.
  `fragmentLevel` is **not** "every read yields the same key": a supplementary
  segment carries its own strand and its own `pair_orientation`, so it disagrees
  with its primary and the fragment's answer is the primary read1's. A new
  `GroupByType` member is a compile error until it's classified, and each
  entry's `type` is pinned to its own registry key.
- Key generators must cover **both** worlds this pipeline serves — hence
  `strand` over `SAM_FLAG_REVERSE`, and `getMappingQuality`.
- Chain numbering is **per worker call**, so anything unioning chains across
  calls keys by chain **name**, not chainIdx.

## One value, three types, one per invalidation tier

`WorkerPileupData` is what this RPC returns. `PileupLayoutArrays` is what
main-thread layout adds, `readTagColors`/`readColorCategories` what the two
color bakes add, and `PileupDataResult` is the whole of it — the value a
renderer, hit test or overlay reads. The display's tier rule
(plugins/alignments/src/LinearAlignmentsDisplay/CLAUDE.md §"Which getter decides
what a setting invalidates") is therefore type-checked rather than remembered:

- **The worker cannot ship a placeholder** for a row it doesn't know. It used to
  ship eleven — a zero `maxY`, empty color arrays, three empty line/tint passes
  — and each one was a field whose real producer lived elsewhere.
- **`cloneWithLayout` returns a different type than it takes**, so a pass that
  reads `readYs` cannot be handed raw data. `withoutLayout` is the zero-row
  answer for the two cases that place nothing (an empty region, a lane collapsed
  to its coverage band) — a real layout, not a gap.
- **`overlayReadColorCategories` takes `TagColoredPileupData`**, which is how
  the "tag colors first, the `noTagValue` bucket is read off them" ordering
  stopped being a comment.

A pass that only reads fetched arrays (arcs, sashimi, the coverage domain) says
`WorkerPileupData` and can then be fed either. That direction is the safe one,
so prefer the narrowest tier a function actually reads.

## A fixture builds on `testPileupData`, never `as unknown as`

`WorkerPileupData` has ~80 required fields, so the cast looked free. It turns
off excess-property checking, so a misspelled field is accepted in silence, and
it lets a fixture omit a field production code later starts reading.
`baseWorkerPileupData(n)` supplies the worker's required set and
`basePileupDataResult(n)` carries it through both main-thread tiers with the
production functions; `makePileupDataResult` sizes either from whichever
per-read array you pass.

The optional fields are left out **on purpose** — they are what `isChainData`
narrows on, so a base that filled them would move tests to the other branch
without saying so.

## The placement axis is segmented per refName — in BOTH layouts

RefNames share a coordinate space but occupy disjoint screen space, so one axis
collides regions that never overlap. Pileup shifts each read's unioned extent as
a unit; chain shifts each region's bounds **before** merging by name, because a
chain can span refNames. Chain had this bug after pileup's was fixed.

## `sortedBy` names a column, not an offset — `sortForRegions` is the gate

It applies **only when every region being laid out is on `sortedBy.refName`**,
so a localized sort can't false-match the same number on another chromosome.
Both layout paths call it: the gate lived in the multi-region path alone while
the single-region path — most browsing — passed `sortedBy` straight through, and
the slot is **config**, so a sort set at chr1:1000 silently reordered chr2's
reads with the menu still showing a sort as active.

It is also what the display's `sortedBy` getter promises: it canonicalizes the
refName because a session spec can carry an alias, and says an unresolvable one
leaves the reads _unsorted_. The multi-region path keeps its own `regions &&`
check on top — structural, not policy.

**Which reads a sort ranks is `partitionBySort`, and it is not just the span
test.** An interbase mark sits BETWEEN reference bases, so a right-edge soft or
hard clip is recorded at the read's **exclusive end** and `end > sortPos` drops
it — sinking the clipped reads below the ones reading through the breakpoint,
the inverse of the request, while the track menu showed the sort as applied
(interbase types tick "Base pair"). A read carrying a ranked mark at `sortPos`
counts however its alignment ends. Left-edge clips sit on the read's own start,
so the feature worked on half its inputs, and the interbase sorts are reachable
only from the right-click menu.

`showSoftClipping` belongs in `rpcProps` — the worker gates per-base extraction
on it.
