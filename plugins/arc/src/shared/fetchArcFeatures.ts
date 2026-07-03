import { getConf } from '@jbrowse/core/configuration'
import { dedupe, getContainingView, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { isAlive } from '@jbrowse/mobx-state-tree'
import {
  evaluateRegionTooLarge,
  resolveByteLimit,
} from '@jbrowse/plugin-linear-genome-view'

import { regionSignature } from './regionSignature.ts'

import type { ArcDisplayModel } from './ArcDisplayModel.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Byte-only too-large gating, like LinearAlignmentsDisplay: the index byte
// estimate (CoreGetFeatureDensityStats → getRegionByteSize for tabix adapters)
// short-circuits an over-budget region before the feature download. Force-load
// raises userByteSizeLimit (RegionTooLargeMixin) so a forced fetch isn't
// re-blocked; alwaysRender adapters never gate.
export async function fetchArcFeatures(self: ArcDisplayModel) {
  const sessionId = getRpcSessionId(self)
  const { rpcManager } = getSession(self)
  const view = getContainingView(self) as LinearGenomeViewModel

  if (!view.initialized || self.error || self.regionTooLarge) {
    return
  }
  const regions = view.staticBlocks.contentBlocks
  if (!regions.length) {
    return
  }

  const stats = await rpcManager.call(sessionId, 'CoreGetFeatureDensityStats', {
    regions,
    adapterConfig: self.adapterConfig,
  })
  if (!isAlive(self)) {
    return
  }
  self.setFeatureDensityStats(stats)
  const status = evaluateRegionTooLarge({
    visibleBp: view.visibleBp,
    bytes: stats.bytes,
    byteLimit: resolveByteLimit({
      userByteSizeLimit: self.userByteSizeLimit,
      adapterFetchSizeLimit: stats.fetchSizeLimit,
      configFetchSizeLimit: getConf(self, 'fetchSizeLimit'),
    }),
    alwaysRender: stats.alwaysRender,
  })
  if (status.tooLarge) {
    self.setRegionTooLarge(true, status.reason)
    return
  }
  self.setRegionTooLarge(false)

  self.setLoading(true)
  try {
    const ret = await rpcManager.call(sessionId, 'CoreGetFeatures', {
      regions,
      adapterConfig: self.adapterConfig,
    })
    if (isAlive(self)) {
      self.setFeatures(dedupe(ret, r => r.id()), regionSignature(regions))
    }
  } finally {
    if (isAlive(self)) {
      self.setLoading(false)
    }
  }
}
