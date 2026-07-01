import { useVirtualScrollWheel } from '@jbrowse/core/util/useVirtualScrollWheel'

import { applyRowResizeWheel } from './applyRowResizeWheel.ts'

export function useVariantVirtualScroll({
  canvas,
  scrollTop,
  setScrollTop,
  totalHeight,
  viewportHeight,
  scrollZoom,
  rowHeight,
  nrow,
  setRowHeight,
}: {
  canvas: HTMLCanvasElement | null
  scrollTop: number
  setScrollTop: (n: number) => void
  totalHeight: number
  viewportHeight: number
  scrollZoom: boolean
  rowHeight: number
  nrow: number
  setRowHeight: (n: number) => void
}) {
  useVirtualScrollWheel(canvas, (e, applyScroll) => {
    if (e.shiftKey) {
      applyRowResizeWheel(e, canvas!, {
        rowHeight,
        scrollTop,
        nrow,
        viewportHeight,
        setRowHeight,
        setScrollTop,
      })
    } else if (!scrollZoom && !e.ctrlKey && !e.metaKey) {
      const next = applyScroll(e, {
        scrollTop,
        viewportHeight,
        scrollableHeight: Math.max(0, totalHeight - viewportHeight),
      })
      if (next !== null) {
        setScrollTop(next)
      }
    }
  })
}
