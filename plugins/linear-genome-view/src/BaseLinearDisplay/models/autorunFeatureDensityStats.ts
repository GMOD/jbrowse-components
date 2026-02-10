import { getContainingView, isAbortException } from '@jbrowse/core/util'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { untracked } from 'mobx'

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
 * Tracked observables (trigger re-runs on zoom/scroll):
 *   view.initialized, view.staticBlocks.contentBlocks, self.error
 *
 * featureDensityStats is read via untracked() so that setting new stats
 * does NOT trigger a re-run (which would cause an infinite loop with
 * byte-based adapters like BAM/CRAM that return bytes but no featureDensity).
 *
 * For featureDensity-based adapters: stats are cached forever (featureDensity
 * scales naturally with bpPerPx in the regionTooLarge getter).
 *
 * For byte-based adapters: stats are re-fetched on view changes so the byte
 * estimate stays current as the user zooms in/out.
 */

// Per-display generation counter.  When the autorun re-fires (e.g. blocks
// change during reload), only the latest generation's result is applied.
const statsGenerations = new WeakMap<BaseLinearDisplayModel, number>()

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

    // Read featureDensityStats WITHOUT tracking to avoid infinite loop.
    // The autorun re-runs when the VIEW changes (blocks/zoom), not when
    // stats change.
    const currentStats = untracked(() => self.featureDensityStats)

    // featureDensity-based adapters: cache forever, featureDensity scales
    // with bpPerPx automatically in the regionTooLarge getter
    if (currentStats?.featureDensity !== undefined) {
      return
    }

    // Byte-based adapters (or first fetch): re-fetch for current view.
    // Clear the cached promise so getFeatureDensityStats makes a fresh RPC call.
    const gen = (statsGenerations.get(self) ?? 0) + 1
    statsGenerations.set(self, gen)
    self.setFeatureDensityStatsP(undefined)
    console.debug('[autorunFeatureDensityStats] fetching stats, gen=', gen)
    const stats = await self.getFeatureDensityStats()
    if (isAlive(self) && gen === statsGenerations.get(self)) {
      console.debug('[autorunFeatureDensityStats] got stats, gen=', gen, stats)
      self.setFeatureDensityStats(stats)
    } else {
      console.debug('[autorunFeatureDensityStats] discarding stale stats, gen=', gen, 'current=', statsGenerations.get(self))
    }
  } catch (e) {
    console.error(e)
    if (isAlive(self) && !isAbortException(e)) {
      self.setError(e)
    }
  }
}
