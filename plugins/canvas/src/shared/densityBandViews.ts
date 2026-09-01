import { foundationDisplayPhase } from '@jbrowse/display-kit/foundationDisplayPhase'

import { densityBandLayer } from './densityBand.ts'

import type { DensityBandLayer } from './densityBand.ts'
import type { FeatureDensity } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { DisplayPhaseFoundation } from '@jbrowse/display-kit/foundationDisplayPhase'
import type { RegionHost } from '@jbrowse/display-kit/regionHost'
import type { DisplayPhase } from '@jbrowse/render-core/displayPhase'

/**
 * What the density band reads off the display composing it: `DensityTierMixin`'s
 * read and its swap decision, plus the phase foundation's own terms so the
 * override below post-processes the base rather than restating it.
 */
export interface DensityBandHost extends DisplayPhaseFoundation {
  host: RegionHost
  densityBins: ReadonlyMap<number, FeatureDensity>
  densityBinsKey: string | undefined
  densityLoading: boolean
  densityError: unknown
  densityTierActive: boolean
  viewportWithinLoadedData: boolean
  dataSuperseded: boolean
}

export function displayDensityBandLayer(
  self: DensityBandHost,
): DensityBandLayer {
  return densityBandLayer(self.densityBins, self.host.coarseBpPerPx)
}

/**
 * Whether the band is still waiting on its first read for what is on screen.
 * The key, not a per-region check against `visibleRegions`: that array rebuilds
 * on every frame of every gesture, and this feeds `displayPhase`. It is cleared
 * on navigation with the bins, so it cannot answer for a region the user has
 * left, and a read that committed nothing for a region still ends the wait —
 * an empty band is the honest answer there, where 'loading' would never lift.
 */
export function densityBandPending(self: DensityBandHost) {
  return (
    self.densityLoading ||
    (self.densityBinsKey === undefined && self.densityError === undefined)
  )
}

/**
 * The gate's banner, swapped for the band. Only the `tooLarge` terminal is
 * post-processed — the display really is over budget and really is fetching no
 * features, so the verdict stays exactly what `RegionTooLargeMixin` derived and
 * this changes only what the chrome does about it. Both of the gate's axes reach
 * here, since both are terms of that one verdict.
 */
export function densityBandDisplayPhase(self: DensityBandHost): DisplayPhase {
  const base = foundationDisplayPhase(
    self,
    () => self.viewportWithinLoadedData && !self.dataSuperseded,
    () => self.host.effectiveBodyMounted,
  )
  return base === 'tooLarge' && self.densityTierActive
    ? densityBandPending(self)
      ? 'loading'
      : 'ready'
    : base
}
