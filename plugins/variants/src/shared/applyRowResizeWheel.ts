// shift+wheel resizes the sample rows (a vertical-zoom gesture) rather than
// scrolling, keeping the row under the cursor pinned in place as the height
// changes. Shared by the matrix (virtual scrollbar) and plain (native overflow)
// variant displays so the gesture stays identical. setScrollTop clamps to the
// new scrollableHeight, so the raw target is passed through unclamped.

import { normalizeWheelDelta } from '@jbrowse/core/util/wheelZoom'

const MAX_ROW_HEIGHT = 20

// px of row-height change per pixel of normalized wheel scroll. A mouse notch
// (~100px) nudges the height ~0.4px; a trackpad's small continuous deltas
// accumulate smoothly instead of the old sign-based ±1-per-event, which flew
// through the whole range on a trackpad's event flood.
const RESIZE_PX_PER_WHEEL_PX = 1 / 240

interface RowResizeTarget {
  // resolved row height (never the raw 0/fit sentinel) — this is divided into
  // below, so a 0 here would produce Infinity
  effectiveRowHeight: number
  scrollTop: number
  nrow: number
  // height available to rows; the min row height is this divided by nrow, i.e.
  // the auto-fit height, so rows can never shrink past fitting the viewport
  viewportHeight: number
  setRowHeight: (n: number) => void
  setScrollTop: (n: number) => void
}

export function applyRowResizeWheel(
  e: WheelEvent,
  el: HTMLElement,
  model: RowResizeTarget,
) {
  e.preventDefault()
  // scroll up (deltaY < 0) grows rows; proportional to the normalized delta so
  // the speed is consistent across mice/trackpads and finer than ±1/event.
  const delta =
    -normalizeWheelDelta(e.deltaY, e.deltaMode) * RESIZE_PX_PER_WHEEL_PX
  // guard nrow=0 (no samples) so the auto-fit floor stays finite
  const minRowHeight = model.viewportHeight / Math.max(1, model.nrow)
  // With few samples the auto-fit floor can exceed MAX_ROW_HEIGHT; the floor
  // wins so the cap can't snap rows below the fit height (which would collapse
  // rows on a *grow* gesture, since min(MAX, max(floor, x)) === MAX < floor).
  const maxRowHeight = Math.max(MAX_ROW_HEIGHT, minRowHeight)
  const newRowHeight = Math.max(
    minRowHeight,
    Math.min(maxRowHeight, model.effectiveRowHeight + delta),
  )
  const mouseY = e.clientY - el.getBoundingClientRect().top
  const rowUnderMouse = (mouseY + model.scrollTop) / model.effectiveRowHeight
  model.setRowHeight(newRowHeight)
  model.setScrollTop(rowUnderMouse * newRowHeight - mouseY)
}
