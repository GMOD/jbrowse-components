import { foundationDisplayPhase } from './foundationDisplayPhase.ts'
import { foundationSvgReady } from './foundationSvgReady.ts'

import type { DisplayPhaseFoundation } from './foundationDisplayPhase.ts'
import type { SvgReadyFoundation } from './foundationSvgReady.ts'
import type { DisplayPhase } from '@jbrowse/render-core/displayPhase'

/**
 * What the density band's phase reads off a display drawing one:
 * `DensityTierMixin`'s read, the display's own stand-in term, and the phase
 * foundation's terms so the swap post-processes the base rather than restating
 * it. `densityBandActive` is the display's word for "the band is standing in
 * right now" — the tier's verdict plus, on alignments, a visible coverage band.
 */
export interface DensityBandPhaseHost
  extends DisplayPhaseFoundation, SvgReadyFoundation {
  host: { effectiveBodyMounted: boolean }
  densityBinsKey: string | undefined
  densityLoading: boolean
  densityBandActive: boolean
  viewportWithinLoadedData: boolean
  dataSuperseded: boolean
}

/**
 * Whether the band is still waiting on its first read for what is on screen.
 * The key, not a per-region check against `visibleRegions`: that array rebuilds
 * on every frame of every gesture, and this feeds `displayPhase`. It is cleared
 * on navigation with the bins, so it cannot answer for a region the user has
 * left, and a read that committed nothing for a region still ends the wait —
 * an empty band is the honest answer there, where 'loading' would never lift.
 * A failed read lands on the display's own `error`, which outranks this.
 */
export function densityBandPending(self: DensityBandPhaseHost) {
  return self.densityLoading || self.densityBinsKey === undefined
}

/**
 * The phase with the band standing in. Where the band is up the display is
 * drawing it and nothing else, so the base's fetch terms are not its loading
 * question: not the banner, whose verdict is untouched underneath, and not the
 * feature fetch, which `fetchSuspended` has stopped where the gate was not
 * already stopping it. The band's own read is, so the phase is `loading` until
 * it lands and `ready` after. The two failure terminals pass through, and so
 * does a standing cancel: its Retry chrome is the way back, and the export gate
 * fails on it after the wait.
 */
export function densityBandDisplayPhase(
  self: DensityBandPhaseHost,
): DisplayPhase {
  const base = foundationDisplayPhase(
    self,
    () => self.viewportWithinLoadedData && !self.dataSuperseded,
    () => self.host.effectiveBodyMounted,
  )
  return self.densityBandActive &&
    !self.fetchCanceled &&
    base !== 'error' &&
    base !== 'renderError'
    ? densityBandPending(self)
      ? 'loading'
      : 'ready'
    : base
}

/**
 * The export gate under the same swap: `regionTooLarge` is a terminal in
 * `computeSvgReady` because nothing is coming, and `dataCurrent` waits on a
 * feature fetch that is not running, so with the band up the bins are what the
 * export waits for — sampled before they land, it writes the band empty.
 */
export function densityBandSvgReady(self: DensityBandPhaseHost) {
  return self.densityBandActive
    ? !!self.error || self.fetchCanceled || !densityBandPending(self)
    : foundationSvgReady(self)
}
