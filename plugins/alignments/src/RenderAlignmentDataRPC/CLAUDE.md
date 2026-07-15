# RenderPileupDataRPC

## One RPC for pileup + chain

`RenderAlignmentData` (`executeRenderAlignmentData.ts`) serves both displays,
branching on `args.linkedReads` (`'off'` → pileup, else chain). Shared spine
(fetch → arrays → coverage → assembly); only pre-processing differs — both run
`filterChainFeatures` (dedupe + singleton/proper-pair/split-only filter, grouped
by read name, so it applies in pileup too); chain additionally builds chain
metadata, pileup additionally does ref-sequence fetch + sort-tag values.
Chain-only result fields are optional on `PileupDataResult`.

## Two feature categories: row-instanced vs position-aggregate

Every drawable splits along one axis the field names and upload signatures
otherwise leave implicit. Which category a feature is in answers, in one stroke:
does it carry `*Ys`, where does it pack, and what upload signature it uses.

|                     | **Row-instanced**                                                                             | **Position-aggregate**                                                   |
| ------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Features            | read, gap, mismatch, insertion/softclip/hardclip, modification, perBaseQuality, perBaseLetter | coverage, snpCoverage, interbase histogram, indicator, modCoverage       |
| Carries `*Ys`?      | yes — one instance per (read, pileup row)                                                     | no — a histogram keyed on genomic position                               |
| Packed where        | **main thread**, at upload, after layout fills `*Ys` (`features/X/packGpu.ts`)                | **worker**, emitted as a `*PackedBuffer` + count (`runCoveragePipeline`) |
| Upload signature    | `uploadX(hal, idx, data)` — repacks each sync                                                 | `uploadX(hal, idx, packedBuffer, count)` — buffer already built          |
| In `PILEUP_LAYERS`? | yes — z-ordered, gated, parity-checked across both renderers                                  | no — different draw signature + its own scissored coverage band          |

Row-instanced features can't pre-pack in the worker for the same reason layout
runs on the main thread: a read's row (`readYs`) isn't known until the main
thread lays out all visible regions together (a read spanning a region boundary
must share one row). Position-aggregate features are row-independent, so the
worker packs them once and the main thread uploads the bytes verbatim.

`uploadReads` is the lone ordering constraint — it _creates_ the region entry
(readPositions / readYs / readIdToIndex) that every other row-instanced upload
and `uploadCoverage` read back, so it runs first in
`GpuAlignmentsRenderer.sync`. (Paired-end arcs / sashimi / chain connectors are
a separate scissored-band concern — see the LinearAlignmentsDisplay renderer
CLAUDE.md.)

## Group-by partition: pileup per-read, chain per-chain

`groupBy` partitions the single fetch into N ordered sections that the spine
runs over once each. Pileup uses `partitionFeatures` (per read). Chain uses
`partitionChains`: reads sharing a QNAME are one chain and move into a section
as a unit (via the chain's representative read's key), so a chain never splits —
which would break connecting lines and desync mate rows.

The chain key is `chainGroupingKey` (`shared/chainGroupingKey.ts`), the single
source of truth used by every by-name grouping site (`partitionChains`,
`filterChainFeatures`, `buildChainMetadata`). It returns the QNAME for
primary/supplementary reads — mates and split segments chain together — but a
unique synthetic key for **secondary** alignments (0x100), so a secondary (a
competing mapping of the same read to another locus, e.g. an RNA-seq
multimapper) never joins its primary's chain and renders standalone. This
mirrors IGV and the connection resolver `readGroupConnections`, which also drops
secondary.

Chain mode therefore only allows **chain-consistent** dimensions — ones where
every read of a chain yields the same key (`tag`, `firstOfPairStrand`,
`pairOrientation`). Per-read dimensions (`strand`, `supplementary`, `mapq`,
`duplicate`) are excluded; a disallowed value from an old session degrades to
ungrouped (never splits). This is data-driven: the `chainConsistent` flag in
`GROUP_BY_DIMENSIONS` (`shared/groupFeatures.ts`) is the single source the
worker guard (`isChainGroupableType`) and the group-by dialog's menu both read,
so they can't disagree. Adding a `GroupByType` member is a compile error until
it's classified there.

Chain numbering (`readChainIndices` → chainIdx) is **per worker call** (per
region _and_ per group), so the same integer means different chains across
calls. Anything unioning chains across calls must key by chain **name**
(`chainNames`), not chainIdx — see `buildChainIdMap` / `mergeChains`.
Cross-region edge: a chain can still split when its representative read differs
per region, since each region keys its local reads from what it can see. Two
cases: (a) a grouping **tag** present on some mates but missing on others, and
(b) **firstOfPairStrand**, where a split/supplementary alignment mapped to the
opposite strand keys differently than the primary — so a chain spanning regions
whose far end is a strand-flipped supplement can land in two sections. Both are
accepted limitations of per-region partitioning, not bugs to fix.

## `computeMultiRegionLayout`: the placement axis is segmented per refName

Reads are placed by genomic coordinate, and refNames share that coordinate space
— `ctgA:1-50,000` and `ctgB:1-6,000` both start at 1 — while occupying disjoint
screen space. Placing every region's reads on one axis therefore collided
regions that never overlap on screen: each ctgB read was pushed below every ctgA
read covering the same bp, so ctgB's pileup started well below row 0 with a
wedge of whitespace above it. `segmentExtentsByRefName` shifts each refName onto
its own disjoint span of the axis before placement (a read only ever spans
regions of one refName, so its unioned extent moves as a unit). It is a no-op
for single-refName views, which includes collapse-introns.

## `computeMultiRegionLayout` sort/softclip: same-refName only

`computeMultiRegionLayout` (in `sortLayout.ts`) honors `showSoftClipping`
everywhere (soft-clip extents are unioned per featureId across the regions a
read spans) but applies `sortedBy` **only when every displayed region shares one
refName** — the collapse-introns case (a transcript's exons), where reads live
on a single coordinate axis so the localized sort at `sortedBy.pos` can't
false-match a same-numbered position on another chromosome. It needs the region
bounds to do this, threaded in as `regions` (from `model.loadedRegions`, mirrors
the arcs `regionInfos` path) → `buildLaidOutPileupMap` → here.

Mixed-refName multi-region views (e.g. "view mate" jumping to another
chromosome) keep plain dedup order for the sort — the sort is skipped rather
than risk a cross-chromosome false-match. Not a fundamental limit, just unbuilt;
the placement axis it would need is now segmented (see above), so what remains
is choosing which region's reads a localized sort should order.

## `showSoftClipping` belongs in `rpcProps`

The worker uses `showSoftClipping` in `features/softclip/extract.ts` to gate
per-base softclip sequence extraction (the bases are not produced when off). So
toggling it is a fetch-invalidating setting, not a main-thread-only one. Don't
move it to `gpuProps`.
