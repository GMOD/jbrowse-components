import type { RegionPairRun } from '../HicAdapter/HicAdapter.ts'
import type { Region } from '@jbrowse/core/util'

/**
 * What the *view* knows about one displayed block and the worker cannot see,
 * parallel to `RenderHicDataArgs.regions`.
 *
 * It travels beside `regions` rather than on them because the RPC framework
 * owns that array: `RpcMethodTypeWithRenameRegions` rewrites every
 * `regions[].refName` into the adapter's naming scheme during serialization,
 * and it knows nothing of screen layout. Both fields are casualties of that:
 *
 * - `refName` — a Juicer `.hic` keyed on `1`/`2`/`X` against an hg38 assembly
 *   keyed on `chr1` is the ordinary case, not a corner one, so echoing the
 *   renamed name back labelled a hover `1:…` under a ruler reading `chr1:…`.
 * - `offsetPx` — `dynamicBlocks` *elides* any displayed region narrower than
 *   `minimumBlockWidth` and `contentBlocks` drops elided blocks, while the ruler
 *   still gives them their width. A running sum of region widths in the worker
 *   therefore slid every region after an elided one leftward of its true
 *   position. See `calcViewBlocks`.
 */
export interface HicViewBlock {
  /** the refName the view displays, before adapter renaming */
  refName: string
  /** screen-axis position in fetch-time pixels from the apex (data-x = 0) */
  offsetPx: number
}

export interface RenderHicDataArgs {
  adapterConfig: Record<string, unknown>
  regions: Region[]
  /** parallel to `regions`; see {@link HicViewBlock} */
  viewBlocks: HicViewBlock[]
  bpPerPx: number
  resolution: number
  normalization: string
}

export interface HicContactItem {
  bin1: number
  bin2: number
  counts: number
  region1Idx: number
  region2Idx: number
}

/**
 * Everything the main thread needs to read a region back out of `positions[]`,
 * one record per region index — the index `pairRuns` carries, and the one
 * `HicContactItem` reports.
 *
 * One array of records rather than four parallel columns: every consumer reads
 * several of these fields for the *same* region at once (hover un-mirrors, then
 * subtracts the offset, then labels), so splitting them bought nothing and cost
 * an alignment invariant that only comments enforced. Region counts are small —
 * this is a handful of objects beside the per-contact typed arrays, not
 * per-contact overhead.
 */
export interface HicResultRegion {
  /** the view's refName, forwarded from {@link HicViewBlock} */
  refName: string
  /**
   * Pre-rotation data-x span, in the same coordinate space as `positions[]`.
   * Hover buckets a cursor into a region against it, and the reversed-region
   * mirror reflects within it. Spans are not necessarily contiguous — an elided
   * region leaves a real gap (see {@link HicViewBlock}), which is why both ends
   * are carried rather than reading the next region's start as this one's end.
   */
  dataXStart: number
  dataXEnd: number
  /**
   * Offset baked into `positions[]`:
   * `positionX = (bin1 + combinedOffset) * binWidth`.
   * Hover subtracts it back out to recover bin1/bin2 from a mouse coord.
   */
  combinedOffset: number
  /**
   * The mirror this describes is already baked into `positions[]` (see
   * `executeRenderHicData`), so renderers draw the array as-is and stay
   * orientation-agnostic; hover needs it to un-mirror a cursor back to a bin
   * (`contactLookup.ts`).
   *
   * Baking it at fetch time — rather than mirroring live off the view — is
   * deliberate: `renderTransform` rescales *stale* pixels mid-fetch, and a live
   * read would mirror against a viewport the positions weren't built for.
   * Mixed orientations are fine; each region mirrors only within its own span.
   */
  reversed: boolean
}

export interface HicDataResult {
  /**
   * Every contact as one interleaved record in the **shader's own instance
   * layout** — `hic.slang`'s `HicInstance`, whose generated
   * `INSTANCE_STRIDE_WORDS` / `INSTANCE_OFFSET_F32` every reader indexes with.
   * Word 0/1 are the cell's apex-ward corner in pre-rotation data space, word 2
   * its raw count.
   *
   * Packed here rather than main-thread-side because this is the buffer the GPU
   * takes: `hal.uploadBuffer` accepts it as-is, so the payload transfers
   * zero-copy and is uploaded zero-copy. It used to arrive as parallel
   * `positions`/`counts` arrays that `GpuHicRenderer` re-interleaved with the
   * generated `packInstances` on every fetch — measured 2.5 ms and 3.6 MB at
   * 300k contacts, 39 ms and 54 MB at 4.5M, all of it on the main thread inside
   * the upload autorun.
   *
   * The Canvas2D and SVG paths read the same buffer at stride, which is also
   * one cache line per contact instead of two streams.
   *
   * The coupling to the shader is deliberate and is why the generated constants
   * are imported rather than `3` being written down: a field added to
   * `HicInstance` must move this packer, and the layout is the one thing both
   * ends already agree on.
   */
  instances: Float32Array
  numContacts: number
  /**
   * Color-scale saturation candidates, both always **finite** — they are scored
   * off the finite subset of the counts, so a NaN (the .hic dense-block "no
   * value" marker) or an Infinity (a tiny normalization divisor) in one bin
   * can't reach them. `colorMaxScore` divides by these, and NaN there propagates
   * to every bin's color. `instances` itself may still hold a non-finite count;
   * only that bin is affected. Both are 0 for an empty result.
   */
  maxScore: number
  percentile95: number
  binWidth: number
  /**
   * The binsize this matrix was actually fetched at. `bin1`/`bin2` are
   * chromosome-absolute bin indices, so a contact's genomic start is
   * `bin * resolution`. Carried in the result (not read from the model's live
   * `effectiveResolution`) so hover loci stay correct during a pending refetch.
   */
  resolution: number
  /**
   * The normalization the `.hic` file actually applied, which is not always the
   * one requested: vectors are stored per (type, chr, unit, binsize), so a file
   * can offer KR at 5 kb and nothing at 2.5 Mb. hic-straw's answer was to warn
   * to the console and hand back raw counts; carrying it here lets the track
   * menu tick the scheme in effect rather than the one asked for.
   */
  appliedNormalization: string
  /** one per region index; see {@link HicResultRegion} */
  regions: HicResultRegion[]
  /**
   * Which region pair each stretch of contacts came from, forwarded from the
   * adapter — see {@link RegionPairRun}, whose note explains why membership is a
   * property of the query rather than of a contact.
   *
   * Kept as runs the whole way rather than expanded into per-contact region
   * columns for the hover index, which is what this used to do. Two `Uint16Array`
   * columns are 4 bytes per contact held for the lifetime of the viewport, and a
   * matrix is routinely millions of contacts (~18 MB at 4.5M) — against a handful
   * of objects here, since the pair count is O(regions²).
   *
   * They are also what makes the two per-contact bin columns unnecessary. This
   * used to ship `contactBin1`/`contactBin2` (another 8 bytes per contact,
   * 36 MB at 4.5M, retained for the lifetime of the viewport) on the reasoning
   * that a bin index is chromosome-absolute (~10^6 at a fine binsize) and
   * Float32's ~7 digits cannot round-trip that. True of the bin — but
   * `instances` never stores it: it stores `(bin + combinedOffset) * binWidth`,
   * and `combinedOffset ≈ -start/res` cancels the large term *before* the cast,
   * so what survives the float32 is the small on-screen coordinate.
   * `contactLookup.ts` inverts it against this run table, and the error is
   * ≤1.4e-3 bins across the whole reachable range (fine binsizes, sub-pixel
   * bins, mirrored regions, 4k-wide viewports) — see `binRecovery.test.ts`.
   */
  pairRuns: RegionPairRun[]
}
