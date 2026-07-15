import { getConf } from '@jbrowse/core/configuration'
import { dedupe, getContainingView, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { checkByteEstimate } from '@jbrowse/plugin-linear-genome-view'

import { regionSignature } from './regionSignature.ts'

import type { ArcDisplayModel } from './ArcDisplayModel.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Byte-only too-large gating, like LinearAlignmentsDisplay: the index byte
// estimate (CoreGetFeatureDensityStats → getRegionByteSize) short-circuits an
// over-budget region before the feature download. Force-load raises
// userByteSizeLimit (RegionTooLargeMixin) so a forced fetch isn't re-blocked;
// alwaysRender adapters never gate.
export async function fetchArcFeatures(self: ArcDisplayModel) {
  const sessionId = getRpcSessionId(self)
  const { rpcManager } = getSession(self)
  const view = getContainingView(self) as LinearGenomeViewModel

  // Guards + tracked reads are synchronous, BEFORE runFetch — reads inside the
  // flow aren't tracked by the calling autorun. Un-minimizing / clearing the
  // error / a viewport or force-load change re-fires the autorun via these.
  //
  // NB: regionTooLarge is deliberately NOT an early-return gate. Arc has no
  // ClearBlockingStateOnViewportChange autorun (that lives in
  // MultiRegionDisplayMixin, which arc doesn't compose), so gating on it here
  // would drop the viewport read below from the tracked set the moment the
  // banner shows — zooming in would never re-run this estimate and the banner
  // would wedge until force-load. Instead we re-estimate on every viewport
  // change and let the byte gate self-release, matching every other display.
  if (self.isMinimized || !view.initialized || self.error) {
    return
  }
  const regions = view.staticBlocks.contentBlocks
  if (!regions.length) {
    return
  }
  // Built synchronously (pre-runFetch) so the autorun tracks userByteSizeLimit +
  // fetchSizeLimit + visibleBp — force-load and config changes must re-fire this.
  const byteEstimateConfig = {
    adapterConfig: self.adapterConfig,
    fetchSizeLimit: getConf(self, 'fetchSizeLimit'),
    userByteSizeLimit: self.userByteSizeLimit,
    visibleBp: view.visibleBp,
  }

  // runFetch is the shared cancel-safe lifecycle: it aborts any prior in-flight
  // arc fetch (stop token) and, via fetchGeneration, makes ctx.isStale() true
  // for a superseded run so a slow result can't clobber fresh features. Errors
  // are captured into self.error (no bespoke try/catch); isLoading drives the
  // loading overlay.
  await self.runFetch(async ctx => {
    // Same shared helper as LinearAlignmentsDisplay / maf, so the too-large
    // verdict and banner text can't drift (returns null below
    // AUTO_FORCE_LOAD_BP: no gate).
    const byteEstimate = await checkByteEstimate(
      rpcManager,
      sessionId,
      regions,
      byteEstimateConfig,
      ctx,
    )
    if (ctx.isStale()) {
      return
    }
    if (byteEstimate) {
      // stats set before the too-large short-circuit so force-load has them
      self.setFeatureDensityStats(byteEstimate.stats)
      if (byteEstimate.tooLarge) {
        self.setRegionTooLarge(true, byteEstimate.reason)
        return
      }
    }
    self.setRegionTooLarge(false)

    const ret = await rpcManager.call(sessionId, 'CoreGetFeatures', {
      regions,
      adapterConfig: byteEstimateConfig.adapterConfig,
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
