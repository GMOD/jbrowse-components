import type { HicColorField } from '../LinearHicDisplay/hicColorConfigSchema.ts'
import type { ExpectedValues } from '@gmod/hic'
import type { Region } from '@jbrowse/core/util'
import type { Floor } from '@jbrowse/core/util/fieldPredicate'
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
  /** what each instance's value is: the count, or the count over its expected */
  field: HicColorField
  /** the quantile `quantileScore` answers */
  quantile: number
  /** the `filter` list's floors, which drop a cell before its ratio; unset passes every cell */
  floors?: HicCountFloors
}

/** A floor on each count a cell is built from, unset where none is written. */
export interface HicCountFloors {
  observed?: Floor
  control?: Floor
}

export interface HicContactItem {
  /** the contact's instance, which indexes `HicDataResult.operands` */
  index: number
  bin1: number
  bin2: number
  value: number
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
  /** the pair's expected counts, where the values are observed/expected */
  expected?: ExpectedValues
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
   * Every contact with a count in `hic.slang`'s `HicInstance` layout, the
   * buffer the GPU takes as-is: its apex-ward corner in pre-rotation space,
   * then its count. A NaN count, the file's no-value marker, has no instance.
   */
  instances: Float32Array
  numContacts: number
  /**
   * Maximum and `quantile` of the finite counts, so an Infinity bin cannot
   * poison the color domain. 0 for an empty matrix.
   */
  maxScore: number
  quantileScore: number
  /** the quantile `quantileScore` answers, echoed from the args */
  quantile: number
  /** one bin in pre-rotation units: `resolution / √2` */
  binWidth: number
  originBp: number
  /** the binsize this matrix was fetched at; hover loci read it */
  resolution: number
  /** what the file applied, which falls back per binsize */
  appliedNormalization: string
  /**
   * What the values are: the field asked for, or `observed` where it was
   * observed/expected and the file has no expected values at this binsize.
   */
  appliedField: HicColorField
  /**
   * Under observed/control, each instance's two counts, the map's and the
   * control's, which the ratio alone cannot give back.
   */
  operands?: { observed: Float32Array; control: Float32Array }
  regions: HicResultRegion[]
  /**
   * Hover recovers a contact's bins from its float32 position through these
   * runs: the position stores `(bin + combinedOffset) * binWidth`, whose large
   * terms cancel in double precision before the cast (`binRecovery.test.ts`).
   */
  pairRuns: RegionPairRun[]
}
