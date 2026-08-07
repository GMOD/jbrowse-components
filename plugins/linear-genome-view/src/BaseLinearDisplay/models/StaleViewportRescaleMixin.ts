import { getContainingView } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import {
  computeRenderTransform,
  viewportMatchesLastDrawn,
} from './renderTransform.ts'

import type { LinearGenomeViewModel } from '../../LinearGenomeView/model.ts'
import type { RenderTransform } from './renderTransform.ts'

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
       * #getter
       * True only when the held data was drawn at exactly the current viewport.
       * The freshness half of a global display's `dataCurrent` — the display
       * ANDs its own "data has arrived" term on top, since this mixin owns no
       * data state. Goes false for the whole debounce+RPC window after a
       * pan/zoom, which is what keeps an off-screen SVG export from capturing a
       * matrix fetched for the pre-pan viewport.
       */
      get viewportFresh(): boolean {
        const view = getContainingView(self) as LinearGenomeViewModel
        return viewportMatchesLastDrawn({
          lastDrawnOffsetPx: self.lastDrawnOffsetPx,
          lastDrawnBpPerPx: self.lastDrawnBpPerPx,
          viewOffsetPx: view.offsetPx,
          viewBpPerPx: view.bpPerPx,
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
        const view = getContainingView(self) as LinearGenomeViewModel
        return computeRenderTransform({
          lastDrawnOffsetPx: self.lastDrawnOffsetPx,
          lastDrawnBpPerPx: self.lastDrawnBpPerPx,
          viewOffsetPx: view.offsetPx,
          viewBpPerPx: view.bpPerPx,
        })
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setLastDrawnViewport(offsetPx: number, bpPerPx: number) {
        self.lastDrawnOffsetPx = offsetPx
        self.lastDrawnBpPerPx = bpPerPx
      },
    }))
}

export type StaleViewportRescaleMixinType = ReturnType<
  typeof StaleViewportRescaleMixin
>
