import { getContainingView } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import {
  computeRenderTransform,
  viewportMatchesLastDrawn,
} from './renderTransform.ts'

import type { LinearGenomeViewModel } from '../../LinearGenomeView/model.ts'
import type { RenderTransform } from './renderTransform.ts'

/**
 * The pan/zoom pair a fetch is issued at, and the only thing
 * `commitDrawnViewport` accepts — so a commit cannot be handed a live re-read
 * of the two numbers. See `captureViewport`.
 */
export interface DrawnViewport {
  offsetPx: number
  bpPerPx: number
}

/**
 * #stateModel StaleViewportRescaleMixin
 * #category display
 * #crossCuttingMixin Stale-pixel rescaling for a display whose worker output is in fetch-time pixel space. Nothing — the display records `lastDrawnOffsetPx`/`lastDrawnBpPerPx` from its render callback. Brings the `renderTransform` that keeps stale pixels aligned during a pan-during-fetch and the `viewportFresh` half of `dataCurrent`
 *
 * Records the viewport state (`offsetPx`, `bpPerPx`) at which the canvas was
 * last fully drawn, and derives the two things every consumer wants from it:
 * the `renderTransform` that keeps stale pixels aligned with the live viewport
 * during pan-during-fetch / zoom-during-fetch, and the `viewportFresh`
 * predicate that says the two agree again.
 *
 * Its consumers are the single-global-RPC-result displays (HiC, LD), whose
 * worker output is in fetch-time pixel space relative to the first visible
 * block's start. Both getters live here rather than in each display because
 * they were byte-identical in both, and the pair is what makes the mechanism
 * correct: the transform exists to exploit the gap `viewportFresh` reports, so
 * a display that grew a term in one and not the other would rescale pixels it
 * was simultaneously calling current. The formula itself is in
 * `renderTransform.ts`.
 */
export default function StaleViewportRescaleMixin() {
  return types
    .model('StaleViewportRescaleMixin', {})
    .volatile(() => ({
      /**
       * #volatile
       * offsetPx of the viewport when the canvas was last fully drawn
       */
      lastDrawnOffsetPx: undefined as number | undefined,
      /**
       * #volatile
       * bpPerPx of the viewport when the canvas was last fully drawn
       */
      lastDrawnBpPerPx: undefined as number | undefined,
    }))
    .views(self => ({
      /**
       * #method
       * The viewport as it is right now. **Calling it is the capture**, which is
       * why it is a method and not a getter — the same reason
       * `RegionTooLargeMixin.gateFetchState()` is one.
       *
       * A fetch takes this before its first await and hands that value to
       * `commitDrawnViewport` after, never a live re-read: `ctx.isStale()` trips
       * only on a newer fetch or a cancel, so a pan or zoom during the RPC would
       * otherwise stamp the moved viewport onto data packed for the old one.
       * `renderTransform` would then read scale 1 and leave the stale pixels
       * un-rescaled, while `viewportFresh` — and so `svgReady` — called them
       * current.
       *
       * In `.views()`, never `.actions()`: the two getters below compare against
       * it, and MobX runs an action untracked, so as an action it would leave
       * them blind to every pan and zoom.
       */
      captureViewport(): DrawnViewport {
        const view = getContainingView(self) as LinearGenomeViewModel
        return { offsetPx: view.offsetPx, bpPerPx: view.bpPerPx }
      },
    }))
    .views(self => ({
      /**
       * #getter
       * True only when the held data was drawn at exactly the current viewport.
       * The freshness half of a global display's `dataCurrent` — the display
       * ANDs its own "data has arrived" term on top, since this mixin owns no
       * data state. Goes false for the whole debounce+RPC window after a
       * pan/zoom, which is what keeps an off-screen SVG export from capturing a
       * matrix fetched for the pre-pan viewport.
       */
      get viewportFresh(): boolean {
        const { offsetPx, bpPerPx } = self.captureViewport()
        return viewportMatchesLastDrawn({
          lastDrawnOffsetPx: self.lastDrawnOffsetPx,
          lastDrawnBpPerPx: self.lastDrawnBpPerPx,
          viewOffsetPx: offsetPx,
          viewBpPerPx: bpPerPx,
        })
      },
      /**
       * #getter
       * Forward transform `{ scale, viewOffsetX }` shared by the GPU render,
       * the mouse hit-test, and SVG export — so the pixels drawn, the cell the
       * cursor reports, and the exported geometry can't disagree. Reduces to
       * identity (`scale` 1) while `viewportFresh`.
       */
      get renderTransform(): RenderTransform {
        const { offsetPx, bpPerPx } = self.captureViewport()
        return computeRenderTransform({
          lastDrawnOffsetPx: self.lastDrawnOffsetPx,
          lastDrawnBpPerPx: self.lastDrawnBpPerPx,
          viewOffsetPx: offsetPx,
          viewBpPerPx: bpPerPx,
        })
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Record the viewport a just-committed fetch was issued at. Takes
       * `captureViewport()`'s return value, so there is no pair of loose numbers
       * a caller could fill from the live view instead.
       */
      commitDrawnViewport({ offsetPx, bpPerPx }: DrawnViewport) {
        self.lastDrawnOffsetPx = offsetPx
        self.lastDrawnBpPerPx = bpPerPx
      },
    }))
}

export type StaleViewportRescaleMixinType = ReturnType<
  typeof StaleViewportRescaleMixin
>
