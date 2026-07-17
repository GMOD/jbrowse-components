import type { Region, StatusCallback } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

export interface RenderHicDataArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  regions: Region[]
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
   * Pre-rotation data-x position where each region starts, in the same
   * coordinate space as `positions[]` (length regions.length+1). Hover
   * hit-test buckets a cursor into a region pair against this array.
   */
  regionDataXStarts: number[]
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
