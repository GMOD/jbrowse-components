import type { Region, StatusCallback } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

export interface RenderHicDataArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  regions: Region[]
  /**
   * Where each region sits on the screen axis, in pixels from the apex
   * (data-x = 0), parallel to `regions`. Taken from the view's block layout
   * rather than re-derived from region widths in the worker — see
   * `calcRegionScreenOffsetsPx` for why a running sum is wrong.
   */
  regionOffsetsPx: number[]
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
  /**
   * refName per region index, parallel to the `regions` passed to the RPC.
   * Hover uses `regionRefNames[region1Idx]` to label a contact's locus.
   */
  regionRefNames: string[]
  /**
   * Per-contact grid coordinates, parallel to `counts`/`positions`, used to
   * build the hover hit-test index (`contactLookup.ts`) lazily on the main
   * thread. Kept as transferable typed arrays rather than a string-keyed
   * Record so the index costs nothing to serialize across the worker boundary.
   */
  contactBin1: Uint32Array
  contactBin2: Uint32Array
  contactRegion1: Uint16Array
  contactRegion2: Uint16Array
  /**
   * Pre-rotation data-x span of each region, in the same coordinate space as
   * `positions[]`, flattened as `[start0, end0, start1, end1, …]`. Hover
   * hit-test buckets a cursor into a region pair against this array, and the
   * reversed-region mirror reflects within a span. Spans are not necessarily
   * contiguous — see `calcRegionDataXBounds`.
   */
  regionDataXBounds: number[]
  /**
   * Per-region offset baked into `positions[]`:
   * `positionX = (bin1 + regionCombinedOffsets[r1]) * binWidth`.
   * Hover subtracts this back out to recover bin1/bin2 from a mouse coord.
   */
  regionCombinedOffsets: number[]
  /**
   * `reversed` per region index, parallel to `regionRefNames`. The mirror it
   * describes is already baked into `positions[]` (see `executeRenderHicData`),
   * so renderers draw the array as-is and stay orientation-agnostic; hover
   * needs it to un-mirror a cursor back to a bin (`contactLookup.ts`).
   *
   * Baking it at fetch time — rather than mirroring live off the view — is
   * deliberate: `renderTransform` rescales *stale* pixels mid-fetch, and a live
   * read would mirror against a viewport the positions weren't built for.
   * Mixed orientations are fine; each region mirrors only within its own span.
   */
  regionReversed: boolean[]
}
