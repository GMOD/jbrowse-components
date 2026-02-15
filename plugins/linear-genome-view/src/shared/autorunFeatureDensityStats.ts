import { getContainingView, isAbortException } from '@jbrowse/core/util'
import { isAlive } from '@jbrowse/mobx-state-tree'

import type { LinearGenomeViewModel } from '../LinearGenomeView/index.ts'
import type { FeatureDensityStats } from '@jbrowse/core/data_adapters/BaseAdapter'

export interface FeatureDensityModel {
  currStatsBpPerPx: number
  error: unknown
  featureDensityStats?: FeatureDensityStats
  setCurrStatsBpPerPx: (n: number) => void
  clearFeatureDensityStats: () => void
  getFeatureDensityStats: () => Promise<FeatureDensityStats>
  setFeatureDensityStats: (stats?: FeatureDensityStats) => void
  setError: (error: unknown) => void
}

export default async function autorunFeatureDensityStats(
  self: FeatureDensityModel,
) {
  try {
    const view = getContainingView(self) as LinearGenomeViewModel

    if (
      !view.initialized ||
      !view.staticBlocks.contentBlocks.length ||
      view.bpPerPx === self.currStatsBpPerPx ||
      self.error
    ) {
      return
    }

    // don't re-estimate featureDensity even if zoom level changes,
    // jbrowse 1-style assume it's sort of representative
    if (self.featureDensityStats?.featureDensity !== undefined) {
      self.setCurrStatsBpPerPx(view.bpPerPx)
      return
    }

    self.clearFeatureDensityStats()
    self.setCurrStatsBpPerPx(view.bpPerPx)
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
