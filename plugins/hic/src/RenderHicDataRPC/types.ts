import type { RegionPairRun } from '../HicAdapter/HicAdapter.ts'
import type { Region, StatusCallback } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

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
  sessionId: string
  adapterConfig: Record<string, unknown>
  regions: Region[]
  /** parallel to `regions`; see {@link HicViewBlock} */
  viewBlocks: HicViewBlock[]
  bpPerPx: number
  resolution: number
  normalization: string
  stopToken?: StopToken
  statusCallback?: StatusCallback
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
  positions: Float32Array
  counts: Float32Array
  numContacts: number
  /**
   * Color-scale saturation candidates, both always **finite** — they are scored
   * off the finite subset of `counts`, so a NaN (the .hic dense-block "no value"
   * marker) or an Infinity (a tiny normalization divisor) in one bin can't reach
   * them. `colorMaxScore` divides by these, and NaN there propagates to every
   * bin's color. `counts` itself may still hold a non-finite value; only that
   * bin is affected. Both are 0 for an empty result.
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
   * Per-contact grid coordinates, parallel to `counts`/`positions`, used to
   * build the hover hit-test index (`contactLookup.ts`) lazily on the main
   * thread. Kept as transferable typed arrays rather than a string-keyed
   * Record so the index costs nothing to serialize across the worker boundary.
   *
   * These two genuinely have to be per-contact. They are not recoverable from
   * `positions`: a bin index is chromosome-absolute (~10^6 at a fine binsize)
   * and `positions` is Float32Array, whose ~7 significant digits cannot
   * round-trip that back to an exact integer.
   */
  contactBin1: Uint32Array
  contactBin2: Uint32Array
  /**
   * Which region pair each stretch of contacts came from, forwarded from the
   * adapter — see {@link RegionPairRun}, whose note explains why membership is a
   * property of the query rather than of a contact.
   *
   * Kept as runs the whole way rather than expanded into per-contact region
   * columns for the hover index, which is what this used to do. Two `Uint16Array`
   * columns are 4 bytes per contact held for the lifetime of the viewport, and a
   * matrix is routinely millions of contacts (~18 MB at 4.5M) — against a handful
   * of objects here, since the pair count is O(regions²). Hover resolves a
   * candidate's pair by binary-searching these, which only runs on a bin match.
   */
  pairRuns: RegionPairRun[]
}
