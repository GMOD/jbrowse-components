import type { Region } from '@jbrowse/core/util'
import type { TriangleAxisBlock } from '@jbrowse/display-kit/triangleTransform'

export interface RenderHicDataArgs {
  adapterConfig: Record<string, unknown>
  regions: Region[]
  /**
   * Parallel to `regions`: what the view knows of each block that the RPC's
   * refName renaming would lose — the displayed refName and the axis offset.
   */
  axisBlocks: TriangleAxisBlock[]
  /** axis bp of the first block, echoed so a stale payload stays placed */
  originBp: number
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
 * The contacts `[start, end)` of `instances` that came from one region pair.
 * The runs tile `[0, numContacts)` in order.
 */
export interface RegionPairRun {
  region1Idx: number
  region2Idx: number
  start: number
  end: number
}

/** What reading a region back out of `instances` needs, per region index. */
export interface HicResultRegion {
  /** the view's refName */
  refName: string
  /**
   * Pre-rotation x span (axis bp / √2). Both ends are carried because an
   * elided region leaves a gap before the next.
   */
  dataXStart: number
  dataXEnd: number
  /** `positionX = (bin1 + combinedOffset) * binWidth` */
  combinedOffset: number
  /** already mirrored into `instances`; hover un-mirrors with it */
  reversed: boolean
}

export interface HicDataResult {
  /**
   * Every contact in `hic.slang`'s `HicInstance` layout, the buffer the GPU
   * takes as-is: its apex-ward corner in pre-rotation space, then its count.
   */
  instances: Float32Array
  numContacts: number
  /**
   * Maximum and 95th percentile of the finite counts, so a NaN or Infinity
   * bin cannot poison the colour domain. 0 for an empty matrix.
   */
  maxScore: number
  percentile95: number
  /** one bin in pre-rotation units: `resolution / √2` */
  binWidth: number
  originBp: number
  /** the binsize this matrix was fetched at; hover loci read it */
  resolution: number
  /** what the file applied, which falls back per binsize */
  appliedNormalization: string
  regions: HicResultRegion[]
  /**
   * Hover recovers a contact's bins from its float32 position through these
   * runs: the position stores `(bin + combinedOffset) * binWidth`, whose large
   * terms cancel in double precision before the cast (`binRecovery.test.ts`).
   */
  pairRuns: RegionPairRun[]
}
