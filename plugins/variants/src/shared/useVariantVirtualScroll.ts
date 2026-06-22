import { useEffect, useMemo } from 'react'

import { createScrollLatch, normalizeWheelDeltaY } from '@jbrowse/core/util'
import { useEventCallback } from '@jbrowse/core/util/useEventCallback'

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
      e.preventDefault()
      const delta = e.deltaY > 0 ? -1 : 1
      const minRowHeight = viewportHeight / nrow
      const newRowHeight = Math.min(
        20,
        Math.max(minRowHeight, rowHeight + delta),
      )
      const rect = canvas!.getBoundingClientRect()
      const mouseY = e.clientY - rect.top
      const rowUnderMouse = (mouseY + scrollTop) / rowHeight
      const newScrollTop = Math.max(0, rowUnderMouse * newRowHeight - mouseY)
      setRowHeight(newRowHeight)
      setScrollTop(newScrollTop)
    } else if (
      !scrollZoom &&
      !e.ctrlKey &&
      !e.metaKey &&
      scrollableHeight > 0
    ) {
      const dy = normalizeWheelDeltaY(e.deltaY, e.deltaMode, viewportHeight)
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
