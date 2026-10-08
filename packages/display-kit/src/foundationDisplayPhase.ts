import {
  computeActivityPhase,
  computeDisplayPhase,
} from '@jbrowse/render-core/displayPhase'

import type {
  DisplayActivityInputs,
  DisplayPhase,
  DisplayPhaseInputs,
} from '@jbrowse/render-core/displayPhase'

/**
 * What a display foundation with a rendering backend exposes for the phase:
 * every `computeDisplayPhase` and `computeActivityPhase` input, under the name
 * the mixins already publish it as — the terminals from `RegionTooLargeMixin` /
 * `FetchMixin` / `RenderLifecycleMixin`, the activity terms from the latter two.
 * Both foundations use the same names, so one mapping serves them.
 */
export interface DisplayPhaseFoundation
  extends DisplayPhaseInputs, Omit<DisplayActivityInputs, 'isMinimized'> {}

/**
 * A foundation mixin's `self` as the display it is composed onto: `isMinimized`
 * is `BaseDisplay`'s, which no foundation composes itself.
 */
function composedDisplay<T extends object>(self: T) {
  return self as T & Pick<DisplayActivityInputs, 'isMinimized'>
}

/**
 * `displayPhase` for a display foundation: the shared precedence
 * (`computeDisplayPhase`) over the shared activity phase
 * (`computeActivityPhase`), with the foundation's field names mapped onto both.
 * The twin of `foundationSvgReady`: render-core single-sources the policy, and
 * this single-sources the mapping.
 *
 * `viewportCurrent` is all that genuinely differs, so it stays a parameter:
 * per-region passes its spatial-staleness predicate, global passes
 * `() => true`. `hostMounted` is forwarded for the families whose view can go
 * unmounted under it. Passing `self` straight through keeps the reads inside the
 * thunks, for the MobX reason the compute functions document.
 */
export function foundationDisplayPhase(
  self: DisplayPhaseFoundation,
  viewportCurrent: () => boolean,
  hostMounted?: () => boolean,
): DisplayPhase {
  return computeDisplayPhase(self, () =>
    computeActivityPhase(composedDisplay(self), viewportCurrent, hostMounted),
  )
}
