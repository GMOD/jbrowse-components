import { getContainingView, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import type { LinearReadArcsDisplayModel } from '../LinearReadArcsDisplay/model'
import type { LinearReadCloudDisplayModel } from '../LinearReadCloudDisplay/model'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export interface ReducedFeature {
  name: string
  strand: number
  refName: string
  start: number
  end: number
  id: string
  flags: number
  tlen: number
  pair_orientation: string
  next_ref?: string
  next_pos?: number
  clipPos: number
  SA?: string
}

export interface ChainStats {
  max: number
  min: number
  upper: number
  lower: number
}

/**
 * ChainData for paired-end reads (with insert size statistics)
 * Use this type when stats are definitely present
 */
export interface PairedChainData {
  chains: Feature[][]
  stats: ChainStats
}

/**
 * ChainData for long reads or unpaired data (without insert size statistics)
 * Use this type when stats are definitely absent
 */
export interface UnpairedChainData {
  chains: Feature[][]
  stats?: undefined
}

/**
 * Union type for chain data - can be paired or unpaired
 *
 * Type Safety Examples:
 * ```typescript
 * // ✅ GOOD - Using helper function (catches missing stats at compile time)
 * const data1 = createChainData(chains, stats) // Type: PairedChainData
 * const data2 = createChainData(chains) // Type: UnpairedChainData
 *
 * // ❌ BAD - Direct object creation (doesn't catch missing stats)
 * const data3: ChainData = { chains } // Compiles but stats missing!
 *
 * // ✅ GOOD - Runtime type guard
 * if (hasPairedChainData(data)) {
 *   // data.stats is guaranteed to exist here
 *   console.log(data.stats.upper)
 * }
 *
 * // ✅ GOOD - Runtime assertion
 * assertPairedChainData(data) // Throws if stats missing
 * // data.stats is guaranteed to exist after this line
 * console.log(data.stats.upper)
 * ```
 */
export type ChainData = PairedChainData | UnpairedChainData

/**
 * Helper to create ChainData with proper typing based on whether stats are provided
 * This ensures TypeScript catches missing stats for paired reads
 */
export function createChainData(
  chains: Feature[][],
  stats: ChainStats,
): PairedChainData
export function createChainData(
  chains: Feature[][],
  stats?: undefined,
): UnpairedChainData
export function createChainData(
  chains: Feature[][],
  stats?: ChainStats,
): ChainData {
  if (stats) {
    return { chains, stats }
  }
  return { chains }
}

/**
 * Type guard to check if ChainData has stats (is PairedChainData)
 * This narrows the type from ChainData to PairedChainData
 */
export function hasPairedChainData(
  data: ChainData,
): data is PairedChainData {
  return data.stats !== undefined
}

/**
 * Assert that ChainData has stats, throwing an error if it doesn't
 * Use this when stats are required for correct operation
 */
export function assertPairedChainData(
  data: ChainData,
): asserts data is PairedChainData {
  if (!data.stats) {
    throw new Error(
      'ChainData missing stats - stats are required for paired-end read rendering',
    )
  }
}

export async function fetchChains(
  self: LinearReadArcsDisplayModel | LinearReadCloudDisplayModel,
) {
  const sessionId = getRpcSessionId(self)
  const { rpcManager } = getSession(self)
  const view = getContainingView(self) as LGV

  if (!view.initialized || self.error || !self.statsReadyAndRegionNotTooLarge) {
    return
  }

  self.setLoading(true)
  const ret = (await rpcManager.call(sessionId, 'PileupGetReducedFeatures', {
    sessionId,
    regions: view.staticBlocks.contentBlocks,
    filterBy: self.filterBy,
    adapterConfig: self.adapterConfig,
  })) as ChainData

  self.setChainData(ret)
  self.setLoading(false)
}
