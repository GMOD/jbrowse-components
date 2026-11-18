import {
  computeActivityPhase,
  computeDisplayPhase,
} from '@jbrowse/render-core/displayPhase'

import { foundationDisplayPhase } from './foundationDisplayPhase.ts'
import { foundationSvgReady } from './foundationSvgReady.ts'

import type { CoarseTierRead } from './coarseTier.ts'
import type { DisplayPhaseFoundation } from './foundationDisplayPhase.ts'
import type { SvgReadyFoundation } from './foundationSvgReady.ts'
import type { DisplayPhase } from '@jbrowse/render-core/displayPhase'

/**
 * What the coarse tier's phase reads off a display drawing one:
 * `CoarseTierMixin`'s read, its stand-in term, and the phase foundation's
 * terms so the swap post-processes the base rather than restating it.
 */
export interface CoarseTierPhaseHost
  extends DisplayPhaseFoundation, SvgReadyFoundation {
  host: { effectiveBodyMounted: boolean }
  isMinimized: boolean
  coarseTierRead: CoarseTierRead | undefined
  coarseTierLoading: boolean
  coarseTierStandsIn: boolean
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
function coarseTierPending(
  self: Pick<CoarseTierPhaseHost, 'coarseTierLoading' | 'coarseTierRead'>,
) {
  return self.coarseTierLoading || self.coarseTierRead === undefined
}

/**
 * The phase with the coarse tier standing in. Where the tier is up the display
 * is drawing it and nothing else, so the detail fetch, which `fetchSuspended`
 * has stopped, is not its loading question. The tier's own read is: it takes
 * the detail fetch's place in `computeActivityPhase`, which supplies every
 * other term (the suppressions and the first paint). The tier is current
 * whenever its read has landed, so the viewport term is constant. A standing
 * cancel goes to the foundation, which answers `canceled`: its Retry chrome is
 * the way back, and the export gate fails on it after the wait.
 *
 * The terminals are ranked here rather than read off the foundation: the gate
 * measures the coarse read while the tier is up, so its refusal is the banner
 * and stands, and the foundation would rank a detail-fetch term the tier has
 * suspended.
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
    ? computeDisplayPhase(self, () =>
        computeActivityPhase(
          {
            isMinimized: self.isMinimized,
            fetchInert: self.fetchInert,
            viewportEmpty: self.viewportEmpty,
            isLoading: coarseTierPending(self),
            fetchCanceled: self.fetchCanceled,
            awaitingDependentData: self.awaitingDependentData,
            rendersCanvas: self.rendersCanvas,
            canvasDrawn: self.canvasDrawn,
          },
          () => true,
          () => self.host.effectiveBodyMounted,
        ),
      )
    : foundationDisplayPhase(
        self,
        () => self.phaseViewportCurrent,
        () => self.host.effectiveBodyMounted,
      )
}

/**
 * The export gate under the same swap: the foundation's `dataCurrent` waits on
 * a detail fetch that is not running, so with the tier up its read is what the
 * export waits for. Sampled before it lands, it writes the tier empty.
 */
export function coarseTierSvgReady(self: CoarseTierPhaseHost) {
  return self.coarseTierStandsIn
    ? foundationSvgReady(self, () => !coarseTierPending(self))
    : foundationSvgReady(self)
}
