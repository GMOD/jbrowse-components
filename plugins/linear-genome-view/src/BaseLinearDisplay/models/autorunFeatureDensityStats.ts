import { getContainingView } from '@jbrowse/core/util'
import { isAlive } from 'mobx-state-tree'
import type { BaseLinearDisplayModel } from './BaseLinearDisplayModel'
import type { LinearGenomeViewModel } from '../../LinearGenomeView'

// stats estimation autorun calls getFeatureDensityStats against the data
// adapter which by default uses featureDensity, but can also respond with a
// byte size estimate and fetch size limit (data adapter can define what is too
// much data)
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
      view.bpPerPx === self.currStatsBpPerPx ||
      self.error
    ) {
      return
    }

    // don't re-estimate featureDensity even if zoom level changes,
    // jbrowse1-style assume it's sort of representative
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
    if (isAlive(self)) {
      self.setError(e)
    }
  }
}
