import {
  computeDisplayPhase,
  computeLoadingTerm,
} from '@jbrowse/render-core/displayPhase'

import type {
  DisplayLoadingInputs,
  DisplayPhase,
  DisplayPhaseInputs,
} from '@jbrowse/render-core/displayPhase'

/**
 * What a display foundation must expose for the phase. Every field is named the
 * same on both foundations, which is what lets one mapping serve them — the
 * three terminals from `RegionTooLargeMixin`/`FetchMixin`/`RenderLifecycleMixin`,
 * and the four loading terms from `FetchMixin` + `RenderLifecycleMixin`.
 */
export interface DisplayPhaseFoundation
  extends DisplayPhaseInputs, DisplayLoadingInputs {}

/**
 * `displayPhase` for a display foundation: the shared precedence
 * (`computeDisplayPhase`) over the shared loading term (`computeLoadingTerm`),
 * with this codebase's foundation field names mapped onto both.
 *
 * The twin of `foundationSvgReady`, and it exists for the reason that one does.
 * render-core already single-sources the *policy* twice over — the terminal
 * ranking and the loading expression. What it did not single-source is the
 * **mapping**, and that mapping was the last copy: `MultiRegionDisplayMixin` and
 * `GlobalDataDisplayMixin` each wrote the same seven fields into it, so a term
 * added to `computeLoadingTerm` still had to be wired twice — which is precisely
 * the failure `computeLoadingTerm`'s own header describes ("a term added here
 * reaches every display, instead of reaching whichever family the author
 * happened to be reading"), surviving one level down. The two copies had already
 * drifted once: the global one hard-coded `loadingSuppressed: false`.
 *
 * `viewportCurrent` is all that genuinely differs, and it stays a parameter:
 * per-region passes its spatial-staleness predicate, global passes `() => true`
 * (it keeps the last frame up through a refetch rather than scrimming).
 *
 * Both thunks are load-bearing for MobX, not tidiness. The whole loading term is
 * evaluated only after the terminals are ruled out, so a display showing a
 * banner subscribes to nothing but the terminal flags; `viewportCurrent` is
 * evaluated only after the cheap flags, so a suppressed or already-loading
 * display never subscribes to viewport churn. Passing `self` straight through to
 * both compute functions preserves that: the reads happen inside the thunk, at
 * the point the old object literals were built.
 */
export function foundationDisplayPhase(
  self: DisplayPhaseFoundation,
  viewportCurrent: () => boolean,
): DisplayPhase {
  return computeDisplayPhase(self, () =>
    computeLoadingTerm(self, viewportCurrent),
  )
}
