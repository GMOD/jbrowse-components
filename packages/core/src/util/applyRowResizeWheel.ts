import { normalizeWheelDelta } from './wheelZoom.ts'

import type { VirtualScrollModel } from './useVirtualScrollWheel.ts'

const MAX_ROW_HEIGHT = 20

// A mouse notch (~100px) nudges the height ~0.4px, and a trackpad's small
// deltas accumulate smoothly rather than flying through the range.
const RESIZE_PX_PER_WHEEL_PX = 1 / 240

export interface RowResizeTarget extends VirtualScrollModel {
  /** resolved, never the 0/fit sentinel — this is divided by */
  effectiveRowHeight: number
  nrow: number
  setRowHeight: (n: number) => void
}

/**
 * shift+wheel over a row stack: resize the rows, pinning the row under the
 * cursor. The floor is the fit height, so rows never shrink past filling the
 * viewport. The cap stops a gesture but never moves rows on its own, so it
 * rises to a current height already above it (a pinned `rowHeight` is
 * unbounded).
 */
export function applyRowResizeWheel(
  e: WheelEvent,
  el: HTMLElement,
  model: RowResizeTarget,
) {
  e.preventDefault()
  const delta =
    -normalizeWheelDelta(e.deltaY, e.deltaMode) * RESIZE_PX_PER_WHEEL_PX
  const minRowHeight = model.scrollViewportHeight / Math.max(1, model.nrow)
  const maxRowHeight = Math.max(
    MAX_ROW_HEIGHT,
    minRowHeight,
    model.effectiveRowHeight,
  )
  const newRowHeight = Math.max(
    minRowHeight,
    Math.min(maxRowHeight, model.effectiveRowHeight + delta),
  )
  const mouseY = e.clientY - el.getBoundingClientRect().top
  const rowUnderMouse = (mouseY + model.scrollTop) / model.effectiveRowHeight
  model.setRowHeight(newRowHeight)
  model.setScrollTop(rowUnderMouse * newRowHeight - mouseY)
}
