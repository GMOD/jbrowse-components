import { useEffect, useMemo } from 'react'

import { createScrollLatch, normalizeWheelDelta } from '@jbrowse/core/util'
import { useEventCallback } from '@jbrowse/core/util/useEventCallback'

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
  const scrollableHeight = Math.max(0, totalHeight - viewportHeight)
  const latch = useMemo(() => createScrollLatch(), [])

  const handleWheel = useEventCallback((e: WheelEvent) => {
    if (e.shiftKey) {
      applyRowResizeWheel(e, canvas!, {
        rowHeight,
        scrollTop,
        nrow,
        viewportHeight,
        setRowHeight,
        setScrollTop,
      })
    } else if (
      !scrollZoom &&
      !e.ctrlKey &&
      !e.metaKey &&
      scrollableHeight > 0
    ) {
      const dy = normalizeWheelDelta(e.deltaY, e.deltaMode, viewportHeight)
      const next = latch.scroll(e, scrollTop, dy, scrollableHeight)
      if (next !== null) {
        setScrollTop(next)
      }
    }
  })

  useEffect(() => {
    if (!canvas) {
      return
    }
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [canvas, handleWheel])
}
