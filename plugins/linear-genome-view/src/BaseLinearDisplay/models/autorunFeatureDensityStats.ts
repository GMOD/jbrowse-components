import { getContainingView, isAbortException } from '@jbrowse/core/util'
import { isAlive } from '@jbrowse/mobx-state-tree'

import type { LinearGenomeViewModel } from '../../LinearGenomeView/index.ts'
import type { BaseLinearDisplayModel } from '../model.ts'

/**
 * Autorun that fetches feature density statistics from the data adapter.
 *
 * Stats provide:
 * - featureDensity: features per base pair (for density-based limits)
 * - bytes: estimated data size to fetch (for byte-based limits)
 * - fetchSizeLimit: adapter-defined max bytes (optional)
 *
 * Optimization: Once we have stats with featureDensity, we don't re-fetch
 * on zoom changes. Stats are estimates and "good enough" across zoom levels.
 * This prevents redundant RPC calls while still protecting against loading
 * too much data.
 */
export default async function autorunFeatureDensityStats(
  self: BaseLinearDisplayModel,
) {
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

    // don't re-estimate even if zoom level changes,
    // jbrowse 1-style assume it's sort of representative.
    // check for existence of stats (not just featureDensity) to avoid
    // infinite loop with adapters that return bytes but no featureDensity
    if (self.featureDensityStats !== undefined) {
      return
    }

    self.clearFeatureDensityStats()
    console.debug('[autorunFeatureDensityStats] fetching stats')
    const stats = await self.getFeatureDensityStats()
    if (isAlive(self)) {
      console.debug('[autorunFeatureDensityStats] got stats', stats)
      self.setFeatureDensityStats(stats)
    }
  } catch (e) {
    console.error(e)
    if (isAlive(self) && !isAbortException(e)) {
      self.setError(e)
    }
  }
}
