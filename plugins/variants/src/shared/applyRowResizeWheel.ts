// shift+wheel resizes the sample rows (a vertical-zoom gesture) rather than
// scrolling, keeping the row under the cursor pinned in place as the height
// changes. Shared by the matrix (virtual scrollbar) and plain (native overflow)
// variant displays so the gesture stays identical. setScrollTop clamps to the
// new scrollableHeight, so the raw target is passed through unclamped.

const MAX_ROW_HEIGHT = 20

interface RowResizeTarget {
  rowHeight: number
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
  const delta = e.deltaY > 0 ? -1 : 1
  // guard nrow=0 (no samples) so the auto-fit floor stays finite
  const minRowHeight = model.viewportHeight / Math.max(1, model.nrow)
  const newRowHeight = Math.min(
    MAX_ROW_HEIGHT,
    Math.max(minRowHeight, model.rowHeight + delta),
  )
  const mouseY = e.clientY - el.getBoundingClientRect().top
  const rowUnderMouse = (mouseY + model.scrollTop) / model.rowHeight
  model.setRowHeight(newRowHeight)
  model.setScrollTop(rowUnderMouse * newRowHeight - mouseY)
}
