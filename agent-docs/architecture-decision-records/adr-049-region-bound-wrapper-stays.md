---
status: Accepted
summary: "Keep the per-read `RegionBoundBamFeature` wrapper — `recordClass` moved the wrapper from retained to transient, which is where the cost actually was; eliminating the transient one would change the adapter→extractor contract for ~1%"
---

# ADR-049: The per-read region-bound wrapper stays

## Status

Accepted (keep `withRegionRef` / `RegionBoundBamFeature`). Threading the region
reference through `forEachMismatch` instead is **Rejected**.

## Context

`@gmod/bam`'s `recordClass` option exists so JBrowse's feature class **is** the
decoded record (`BamSlightlyLazyFeature extends BamRecord`) rather than a second
object wrapping one. The stated motivation was memory.

But the wrapper was not actually eliminated. `withRegionRef` allocates a
`RegionBoundBamFeature` per read per fetch, because the record is shared across
regions by `@gmod/bam`'s chunk LRU and per-region state therefore cannot be
assigned onto it (see `plugins/alignments/src/CLAUDE.md` — writing `record.ref`
let the last
fetch to resolve rebind the read for every other region still holding it).

So the honest question is whether `recordClass` bought anything, and whether the
remaining per-read wrapper should be removed too.

## Measurements

**`recordClass` is a real saving, and it is a *retained* one.** 200k records,
node sampling heap profiler:

| | retained |
| --- | --- |
| subclassed (today) | 27.2 MB |
| record + separate wrapper (what it replaced) | 33.5 MB |

**33 bytes/read, 1.23x.** These objects live in the chunk LRU for the whole
render, so this is steady-state worker footprint, not a spike.

**The remaining wrapper is transient, and transient is close to free.** Two
independent measurements say so:

- `@gmod/bam`'s record constructor used to take an options object it unpacked
  immediately, allocating two throwaway objects per record. Flattening it to
  positional args — removing both — measured **1.013x** on a real 300x BAM
  (53,596 records) and **1.04x** on a faithful replica of `readBamFeatures`.
  (A pure-allocation microbench claimed 5.2x. That bench was degenerate; do not
  trust one for this question.)
- V8's sampling heap profiler reports **only survivors**: 500k objects allocated
  and dropped sample as 0.0 MB, the same loop retaining them samples 27 MB.
  Nursery-dead objects never even show up.

`RegionBoundBamFeature` is one such object per read per fetch, and only for reads
*without* an MD tag — `BamAdapter.ts:149` already skips it otherwise. So the
allocation it costs is in the same ~1% band.

## Decision

Keep it.

The lesson `recordClass` actually encodes is not "one object per read instead of
two" — it is **the wrapper moved from retained to transient**, and retained is
the kind that costs. That distinction is the reusable part.

## Rejected: thread the region ref through `forEachMismatch`

`RegionBoundBamFeature` carries exactly `(ref, refOffset)`, `refOffset` is only
`record.start - span.start`, and **`forEachMismatch` is the sole reader** — every
other member of the ~80-line class is pure delegation. That makes "pass the
region ref as a parameter and delete the class" look obvious.

It isn't, because of where the value has to travel. The adapter builds the packed
reference (`seqFetchSpan`, one per fetch) but extraction happens later in
`executeRenderAlignmentData`, and the **feature is the only thing that crosses
that hand-off** — adapters return `ObservableCreate<Feature>`. Threading the ref
instead means changing what an alignments adapter returns, which reaches
`MismatchFeature`'s 5 implementors (BAM, SAM, CRAM, region-bound, synteny) and
its 4 callers. That is a `Feature`-abstraction change to save ~1%.

The genuine argument for removal is not speed: it is that the delegating class
documents three load-bearing traps, one of which (`getTag` being duck-typed by
`@jbrowse/modifications-utils` rather than declared on `Feature`) nothing would
catch if a future edit dropped it. If that class is ever revisited, revisit it
for **that** reason and re-derive the numbers above — do not reopen it on a perf
premise.

## Consequences

- `BamSlightlyLazyFeature` must track `BamRecord`'s constructor signature, since
  it inherits it. That coupling is the price of `recordClass` and it is real: a
  bam-js constructor change is a coordinated two-repo release.
- Per-read allocation in the fetch path is not a promising target. The retained
  side is: `profile-retained.ts` shows the worker holding ~51% `readBamFeatures`
  records and ~20% memoized `_cachedNumericCigar` arrays, which is chunk-LRU
  footprint and belongs to the memory-leak work, not to render latency.
- The GC line on the alignments worker (199 ms of 2165 ms) remains
  **unattributed**. The survivor-only profiler cannot see the transient garbage
  that drives it; `HeapProfiler.startTrackingHeapObjects({trackAllocations:true})`
  can, and is not built yet. Do not treat any measurement here as evidence about
  that line.
