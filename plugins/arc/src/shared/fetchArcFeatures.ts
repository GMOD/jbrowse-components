import { dedupe, getContainingView, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import type { ArcDisplayModel } from './ArcDisplayModel.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export async function fetchArcFeatures(self: ArcDisplayModel) {
  const sessionId = getRpcSessionId(self)
  const { rpcManager } = getSession(self)
  const view = getContainingView(self) as LinearGenomeViewModel

  if (
    !view.initialized ||
    self.error ||
    !self.featureDensityStatsReadyAndRegionNotTooLarge
  ) {
    return
  }

  self.setLoading(true)
  try {
    const ret = await rpcManager.call(sessionId, 'CoreGetFeatures', {
      regions: view.staticBlocks.contentBlocks,
      adapterConfig: self.adapterConfig,
    })
    self.setFeatures(dedupe(ret, r => r.id()))
  } finally {
    self.setLoading(false)
  }
}
