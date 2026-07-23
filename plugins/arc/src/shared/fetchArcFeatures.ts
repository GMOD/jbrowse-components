import { dedupe, getContainingView, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import { regionSignature } from './regionSignature.ts'

import type { ArcDisplayModel } from './ArcDisplayModel.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Fetches every arc feature for the current static blocks. Structured like
// LinearWiggle/LD's global fetch: probe the compressed byte size
// (CoreGetRegionByteEstimate), commit it, and let the DERIVED regionTooLarge
// getter (ArcFetchModel) decide — no imperative flag, no bespoke gating. The
// installGlobalFetchAutorun trigger (afterAttach.ts) gates on regionTooLarge +
// dataLoaded, so this only runs when a fetch is actually needed; runFetch makes
// it cancel-safe so a superseded run can't clobber fresh features.
export async function fetchArcFeatures(self: ArcDisplayModel) {
  if (self.isMinimized) {
    return
  }
  const view = getContainingView(self) as LinearGenomeViewModel
  if (!view.initialized) {
    return
  }
  const regions = view.staticBlocks.contentBlocks
  if (self.regionTooLarge || !regions.length) {
    return
  }
  const { adapterConfig } = self
  await self.runFetch(async ctx => {
    const { rpcManager } = getSession(self)
    const sessionId = getRpcSessionId(self)
    const stats = await rpcManager.call(
      sessionId,
      'CoreGetRegionByteEstimate',
      { regions, adapterConfig },
    )
    if (ctx.isStale()) {
      return
    }
    // Commit the estimate; the derived regionTooLarge getter then composes the
    // shared verdict as a pure function of the estimate × current viewport.
    self.setByteEstimate(stats)
    if (self.regionTooLarge) {
      return
    }

    const ret = await rpcManager.call(sessionId, 'CoreGetFeatures', {
      regions,
      adapterConfig,
      stopToken: ctx.stopToken,
    })
    if (ctx.isStale()) {
      return
    }
    self.setFeatures(
      dedupe(ret, r => r.id()),
      regionSignature(regions),
    )
  })
}
