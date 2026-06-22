import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

export interface RenderHicDataArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  regions: Region[]
  bpPerPx: number
  resolution: number
  normalization: string
  stopToken?: StopToken
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
   * Hover hit-test index. Key = `${r1}|${r2}|${bin1}|${bin2}`, value = index
   * into `counts` (and `positions`). Every drawn rect is the same size and on
   * a deterministic grid, so a Map lookup replaces the previous Flatbush
   * R-tree.
   */
  lookup: Record<string, number>
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
}
