import { computeDisplayPhase } from '@jbrowse/render-core/displayPhase'

import { foundationDisplayPhase } from './foundationDisplayPhase.ts'
import { foundationSvgReady } from './foundationSvgReady.ts'

import type { CoarseTierRead } from './coarseTier.ts'
import type { DisplayPhaseFoundation } from './foundationDisplayPhase.ts'
import type { SvgReadyFoundation } from './foundationSvgReady.ts'
import type { DisplayPhase } from '@jbrowse/render-core/displayPhase'

/**
 * What the coarse tier's phase reads off a display drawing one:
 * `CoarseTierMixin`'s read, the display's own stand-in term, whether the gate
 * is measuring the coarse read itself, and the phase foundation's terms so the
 * swap post-processes the base rather than restating it.
 */
export interface CoarseTierPhaseHost
  extends DisplayPhaseFoundation, SvgReadyFoundation {
  host: { effectiveBodyMounted: boolean }
  coarseTierRead: CoarseTierRead | undefined
  coarseTierLoading: boolean
  coarseTierStandsIn: boolean
  gateMeasuresCoarse: boolean
  phaseViewportCurrent: boolean
}

/**
 * Whether the tier is still waiting on its first read for what is on screen.
 * Whether a read has landed at all, not a per-region check against
 * `visibleRegions`: that array rebuilds on every frame of every gesture, and
 * this feeds `displayPhase`. The read is cleared on navigation with the
 * payloads, so it cannot answer for a region the user has left, and a read that
 * committed nothing for a region still ends the wait — an empty tier is the
 * honest answer there, where 'loading' would never lift. A failed read lands on
 * the display's own `error`, which outranks this.
 */
export function coarseTierPending(
  self: Pick<CoarseTierPhaseHost, 'coarseTierLoading' | 'coarseTierRead'>,
) {
  return self.coarseTierLoading || self.coarseTierRead === undefined
}

/**
 * The phase with the coarse tier standing in. Where the tier is up the display
 * is drawing it and nothing else, so the base's fetch terms are not its loading
 * question: not the detail fetch, which `fetchSuspended` has stopped where the
 * gate was not already stopping it. The tier's own read is, so the phase is
 * `loading` until it lands and `ready` after. A standing cancel passes through:
 * its Retry chrome is the way back, and the export gate fails on it after the
 * wait.
 *
 * The failure terminals are re-ranked rather than read off `base`, which is the
 * one thing that cannot work here: `computeDisplayStatusPhase` ranks
 * `regionTooLarge` above `error`, so under a refusal of the detail fetch — the
 * state a gate-driven tier exists for — `base` is `tooLarge` whatever the read
 * did, and a tier whose read had failed swapped that for a `loading` nothing
 * would ever lift. The verdict is dropped exactly where the tier replaced the
 * banner; where the gate measures the coarse read itself (MAF's summary), its
 * refusal is the banner and stands.
 *
 * The foundation is not consulted at all on that path, which is why it is
 * computed in the other arm rather than above the branch: its loading term
 * walks `visibleRegions`, an array rebuilt on every frame of every gesture, and
 * a tier that never reads the answer should not be subscribed to it.
 */
export function coarseTierDisplayPhase(
  self: CoarseTierPhaseHost,
): DisplayPhase {
  return self.coarseTierStandsIn && !self.fetchCanceled
    ? computeDisplayPhase(
        {
          renderError: self.renderError,
          regionTooLarge: self.gateMeasuresCoarse && self.regionTooLarge,
          error: self.error,
        },
        () => coarseTierPending(self),
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
 * detail fetch that is not running, so with the tier up its read is what the
 * export waits for — sampled before it lands, it writes the tier empty.
 */
export function coarseTierSvgReady(self: CoarseTierPhaseHost) {
  return self.coarseTierStandsIn
    ? !!self.error ||
        self.fetchCanceled ||
        (self.gateMeasuresCoarse && self.regionTooLarge) ||
        !coarseTierPending(self)
    : foundationSvgReady(self)
}
