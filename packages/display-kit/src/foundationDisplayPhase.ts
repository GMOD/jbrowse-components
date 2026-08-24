import {
  computeDisplayPhase,
  computeDisplayStatusPhase,
  computeLoadingTerm,
} from '@jbrowse/render-core/displayPhase'

import type {
  DisplayLoadingInputs,
  DisplayPhase,
  DisplayPhaseInputs,
  DisplayStatusPhase,
  DisplayStatusPhaseInputs,
} from '@jbrowse/render-core/displayPhase'

/**
 * What a display foundation with a rendering backend exposes for the phase:
 * every `computeDisplayPhase` and `computeLoadingTerm` input, under the name the
 * mixins already publish it as — the terminals from `RegionTooLargeMixin` /
 * `FetchMixin` / `RenderLifecycleMixin`, the loading terms from the latter two.
 * Naming them identically on both foundations is what lets one mapping serve
 * them.
 */
export interface DisplayPhaseFoundation
  extends DisplayPhaseInputs, DisplayLoadingInputs {}

/** The same, for a foundation with no rendering backend (arc's SVG). */
export interface DisplayStatusPhaseFoundation
  extends
    DisplayStatusPhaseInputs,
    Pick<
      DisplayLoadingInputs,
      'fetchInert' | 'viewportEmpty' | 'isLoadingOrCanceled'
    > {}

/**
 * `displayPhase` for a display foundation: the shared precedence
 * (`computeDisplayPhase`) over the shared loading term (`computeLoadingTerm`),
 * with the foundation's field names mapped onto both.
 *
 * The twin of `foundationSvgReady`, and it exists for the reason that one does.
 * render-core single-sources the *policy* twice over — the terminal ranking and
 * the loading expression — but not the **mapping**, and that was the last copy:
 * all three foundations wrote the same fields into it by hand, so a term added
 * to `computeLoadingTerm` still had to be wired three times. That is the failure
 * its own header describes ("a term added here reaches every display, instead of
 * reaching whichever family the author happened to be reading"), one level down,
 * and the copies had already drifted: the global one hard-coded
 * `fetchInert: false`.
 *
 * `viewportCurrent` is all that genuinely differs, so it stays a parameter:
 * per-region passes its spatial-staleness predicate, global and arc pass
 * `() => true` (they keep the last frame up through a refetch rather than
 * scrimming). `hostMounted` is forwarded for the families whose view can go
 * unmounted under it — see `computeLoadingTerm`.
 *
 * Both thunks are preserved for the MobX reason the compute functions document:
 * passing `self` straight through means the reads still happen inside the thunk,
 * where the hand-written object literals used to be built.
 */
export function foundationDisplayPhase(
  self: DisplayPhaseFoundation,
  viewportCurrent: () => boolean,
  hostMounted?: () => boolean,
): DisplayPhase {
  return computeDisplayPhase(self, () =>
    computeLoadingTerm(self, viewportCurrent, hostMounted),
  )
}

/**
 * The same mapping for a foundation with **no rendering backend** — arc's
 * main-thread SVG — returning the narrower `DisplayStatusPhase` so it cannot
 * claim the one phase whose banner needs a backend `retry()`.
 *
 * It supplies the two canvas terms rather than asking for them, which is the
 * whole difference: there is no canvas to wait on, so the pre-first-paint term
 * has nothing to observe and constants out. Arc wrote that literal itself until
 * it was the last foundation still doing so, and the fields are spelled out
 * (never `{ ...self }`) because spreading an MST node drops every getter on it.
 */
export function foundationDisplayStatusPhase(
  self: DisplayStatusPhaseFoundation,
  viewportCurrent: () => boolean,
): DisplayStatusPhase {
  return computeDisplayStatusPhase(self, () =>
    computeLoadingTerm(
      {
        fetchInert: self.fetchInert,
        viewportEmpty: self.viewportEmpty,
        isLoadingOrCanceled: self.isLoadingOrCanceled,
        rendersCanvas: false,
        canvasDrawn: false,
      },
      viewportCurrent,
    ),
  )
}
