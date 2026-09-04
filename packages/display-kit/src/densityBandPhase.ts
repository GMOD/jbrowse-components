import { computeDisplayPhase } from '@jbrowse/render-core/displayPhase'

import { foundationDisplayPhase } from './foundationDisplayPhase.ts'
import { foundationSvgReady } from './foundationSvgReady.ts'

import type { DensityRead } from './DensityTierMixin.ts'
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
  densityBinsRead: DensityRead | undefined
  densityLoading: boolean
  densityBandActive: boolean
  phaseViewportCurrent: boolean
}

/**
 * Whether the band is still waiting on its first read for what is on screen.
 * Whether a read has landed at all, not a per-region check against
 * `visibleRegions`: that array rebuilds on every frame of every gesture, and
 * this feeds `displayPhase`. The read is cleared on navigation with the bins,
 * so it cannot answer for a region the user has left, and a read that
 * committed nothing for a region still ends the wait — an empty band is the
 * honest answer there, where 'loading' would never lift. A failed read lands on
 * the display's own `error`, which outranks this.
 */
export function densityBandPending(
  self: Pick<DensityBandPhaseHost, 'densityLoading' | 'densityBinsRead'>,
) {
  return self.densityLoading || self.densityBinsRead === undefined
}

/**
 * The phase with the band standing in. Where the band is up the display is
 * drawing it and nothing else, so the base's fetch terms are not its loading
 * question: not the banner, whose verdict is untouched underneath, and not the
 * feature fetch, which `fetchSuspended` has stopped where the gate was not
 * already stopping it. The band's own read is, so the phase is `loading` until
 * it lands and `ready` after. A standing cancel passes through: its Retry chrome
 * is the way back, and the export gate fails on it after the wait.
 *
 * The two failure terminals are re-ranked rather than read off `base`, which is
 * the one thing that cannot work here: `computeDisplayStatusPhase` ranks
 * `regionTooLarge` above `error`, so under a refusal — the state the tier
 * exists for — `base` is `tooLarge` whatever the read did, and a band whose
 * read had failed swapped that for a `loading` nothing would ever lift. Passing
 * the same terminals back with the verdict dropped is what the band standing in
 * means: the banner it replaced is not a terminal of its own, and a failed read
 * is still a failure.
 *
 * The foundation is not consulted at all on that path, which is why it is
 * computed in the other arm rather than above the branch: its loading term
 * walks `visibleRegions`, an array rebuilt on every frame of every gesture, and
 * a band that never reads the answer should not be subscribed to it.
 */
export function densityBandDisplayPhase(
  self: DensityBandPhaseHost,
): DisplayPhase {
  return self.densityBandActive && !self.fetchCanceled
    ? computeDisplayPhase(
        {
          renderError: self.renderError,
          regionTooLarge: false,
          error: self.error,
        },
        () => densityBandPending(self),
      )
    : foundationDisplayPhase(
        self,
        () => self.phaseViewportCurrent,
        () => self.host.effectiveBodyMounted,
      )
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
