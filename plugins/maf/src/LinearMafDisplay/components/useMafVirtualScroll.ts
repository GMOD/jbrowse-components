import { useVirtualScrollWheel } from '@jbrowse/core/util/useVirtualScrollWheel'

import type { LinearMafDisplayModel } from '../stateModel.ts'

/**
 * Wheel-to-scroll for the rows area. The rows are a fixed-size canvas painted
 * at `-scrollTop`, not a DOM overflow container, so nothing scrolls them
 * without this.
 *
 * A gesture the panel can't consume is left alone: with the rows fitting the
 * track (`scrollableHeight === 0`, always true in fit-to-height mode) the wheel
 * reaches the view and zooms or scrolls the page exactly as it does over any
 * other track. Same for the explicit zoom gestures — scroll-zoom mode and
 * ctrl/meta — which mirror the alignments pileup.
 */
export function useMafVirtualScroll(
  rowsEl: HTMLElement | null,
  model: LinearMafDisplayModel,
) {
  const { scrollZoom } = model.lgv
  useVirtualScrollWheel(rowsEl, (e, applyScroll) => {
    if (!scrollZoom && !e.ctrlKey && !e.metaKey) {
      applyScroll(
        e,
        {
          scrollTop: model.scrollTop,
          viewportHeight: model.rowsHeight,
          scrollableHeight: model.scrollableHeight,
        },
        n => {
          model.setScrollTop(n)
        },
      )
    }
  })
}
