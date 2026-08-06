import { dedupe, getContainingView, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import { regionSignature } from './regionSignature.ts'

import type { ArcDisplayModel } from './ArcDisplayModel.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Fetches every arc feature for the current static blocks. Structured like
// LinearWiggle/LD's global fetch: probe the compressed byte size
// (CoreGetRegionByteEstimate), commit it, and let the DERIVED regionTooLarge
// getter (ArcFetchModel) decide — no imperative flag, no bespoke gating.
// `regionTooLarge` is deliberately not re-checked here or in `shouldFetch`:
// installGlobalFetchAutorun owns that skip, and it lets a blocked display run
// this once per settled viewport so `byteGateBlocksFetch` below can re-measure.
// That costs an index read and returns before any features are fetched. runFetch
// makes it cancel-safe so a superseded run can't clobber fresh features.
export async function fetchArcFeatures(self: ArcDisplayModel) {
  if (self.isMinimized) {
    return
  }
  const view = getContainingView(self) as LinearGenomeViewModel
  if (!view.initialized) {
    return
  }
  const regions = view.staticBlocks.contentBlocks
  if (!regions.length) {
    return
  }
  const { adapterConfig } = self
  await self.runFetch(async ctx => {
    const { rpcManager } = getSession(self)
    const sessionId = getRpcSessionId(self)
    // RegionTooLargeMixin's shared pre-flight gate, called directly because arc
    // fetches through GlobalFetchMixin rather than MultiRegionDisplayMixin's
    // fetchRegions
    if (await self.byteGateBlocksFetch(regions, ctx)) {
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
