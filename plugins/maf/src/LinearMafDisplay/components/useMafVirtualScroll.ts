import { applyRowResizeWheel } from '@jbrowse/core/util/applyRowResizeWheel'
import { useVirtualScrollWheel } from '@jbrowse/core/util/useVirtualScrollWheel'

import type { LinearMafDisplayModel } from '../stateModel.ts'

/**
 * Wheel gestures over the rows area: shift+wheel resizes the rows (a vertical
 * zoom, keeping the row under the cursor put), plain wheel scrolls them. The
 * rows are a fixed-size canvas painted at `-scrollTop`, not a DOM overflow
 * container, so nothing scrolls them without this.
 *
 * A gesture the panel can't consume is left alone: with the rows fitting the
 * track (`scrollableHeight === 0`, always true in fit-to-height mode) the wheel
 * reaches the view and zooms or scrolls the page exactly as it does over any
 * other track. Same for the explicit zoom gestures — scroll-zoom mode and
 * ctrl/meta. Both branches mirror the multi-sample variant displays, which have
 * the same rows-with-a-resolved-height shape.
 */
export function useMafVirtualScroll(
  rowsEl: HTMLElement | null,
  model: LinearMafDisplayModel,
) {
  const { scrollZoom } = model.lgv
  useVirtualScrollWheel(rowsEl, (e, applyScroll) => {
    if (e.shiftKey) {
      // Resizing a row exits fit-to-height into a pinned height, which is what
      // makes the gesture meaningful: the fit height is exactly the floor it
      // shrinks to, so there is nothing to zoom while the sentinel is set.
      applyRowResizeWheel(e, rowsEl!, {
        effectiveRowHeight: model.effectiveRowHeight,
        scrollTop: model.scrollTop,
        nrow: model.nrow,
        viewportHeight: model.rowsHeight,
        setRowHeight: n => {
          model.setRowHeight(n)
        },
        setScrollTop: n => {
          model.setScrollTop(n)
        },
      })
    } else if (!scrollZoom && !e.ctrlKey && !e.metaKey) {
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
