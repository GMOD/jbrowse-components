import { getContainingView, isAbortException } from '@jbrowse/core/util'
import { isAlive } from '@jbrowse/mobx-state-tree'

import type { LinearGenomeViewModel } from '../../LinearGenomeView/index.ts'

/**
 * Autorun that fetches feature density statistics from the data adapter.
 *
 * Stats provide:
 * - featureDensity: features per base pair (for density-based limits)
 * - bytes: estimated data size to fetch (for byte-based limits)
 * - fetchSizeLimit: adapter-defined max bytes (optional)
 *
 * Optimization: Once we have any stats, we don't re-fetch on zoom changes.
 * Stats are estimates and "good enough" across zoom levels. This prevents
 * redundant RPC calls while still protecting against loading too much data.
 */
export default async function autorunFeatureDensityStats(self: {
  error: unknown
  featureDensityStats: unknown
  getFeatureDensityStats: () => unknown
  clearFeatureDensityStats: () => void
  setError: (arg: unknown) => void
  setFeatureDensityStats: (arg: unknown) => void
}) {
  try {
    const view = getContainingView(self) as LinearGenomeViewModel

    // extra check for contentBlocks.length
    // https://github.com/GMOD/jbrowse-components/issues/2694
    if (
      !view.initialized ||
      !view.staticBlocks.contentBlocks.length ||
      self.error
    ) {
      return
    }

    // don't re-estimate once we have any stats. checking for existence
    // (not just featureDensity) prevents an infinite loop with adapters
    // that return bytes but no featureDensity (e.g. BAM/CRAM)
    if (self.featureDensityStats !== undefined) {
      return
    }

    self.clearFeatureDensityStats()
    const stats = await self.getFeatureDensityStats()
    if (isAlive(self)) {
      self.setFeatureDensityStats(stats)
    }
  } catch (e) {
    console.error(e)
    if (isAlive(self) && !isAbortException(e)) {
      self.setError(e)
    }
  }
}
