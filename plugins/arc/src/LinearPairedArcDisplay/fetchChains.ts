import { dedupe, getContainingView, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import type { LinearArcDisplayModel } from './model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export async function fetchChains(self: LinearArcDisplayModel) {
  const sessionId = getRpcSessionId(self)
  const { rpcManager } = getSession(self)
  const view = getContainingView(self) as LGV

  if (
    !view.initialized ||
    self.error ||
    !self.featureDensityStatsReadyAndRegionNotTooLarge
  ) {
    return
  }

  self.setLoading(true)
  const ret = await rpcManager.call(sessionId, 'CoreGetFeatures', {
    regions: view.staticBlocks.contentBlocks,
    adapterConfig: self.adapterConfig,
  })

  self.setFeatures(dedupe(ret, r => r.id()))
  self.setLoading(false)
}
