import { useEffect } from 'react'

export function useVariantVirtualScroll({
  canvasRef,
  scrollTop,
  setScrollTop,
  totalHeight,
  viewportHeight,
  scrollZoom,
  rowHeight,
  nrow,
  setRowHeight,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
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
  const hasOverflow = scrollableHeight > 0

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const handler = (e: WheelEvent) => {
      if (e.shiftKey) {
        e.preventDefault()
        const delta = e.deltaY > 0 ? -1 : 1
        const minRowHeight = viewportHeight / nrow
        const newRowHeight = Math.min(
          20,
          Math.max(minRowHeight, rowHeight + delta),
        )
        const rect = canvas.getBoundingClientRect()
        const mouseY = e.clientY - rect.top
        const rowUnderMouse = (mouseY + scrollTop) / rowHeight
        const newScrollTop = Math.max(0, rowUnderMouse * newRowHeight - mouseY)
        setRowHeight(newRowHeight)
        setScrollTop(newScrollTop)
        return
      }
      if (scrollZoom) {
        return
      }
      if (scrollableHeight <= 0) {
        return
      }
      let dy = e.deltaY
      if (e.deltaMode === 1) {
        dy *= 40
      } else if (e.deltaMode === 2) {
        dy *= viewportHeight
      }
      const next = Math.max(0, Math.min(scrollableHeight, scrollTop + dy))
      if (next !== scrollTop) {
        e.preventDefault()
        setScrollTop(next)
      }
    }
    canvas.addEventListener('wheel', handler, { passive: false })
    return () => {
      canvas.removeEventListener('wheel', handler)
    }
  }, [
    canvasRef,
    scrollTop,
    scrollableHeight,
    viewportHeight,
    scrollZoom,
    rowHeight,
    nrow,
    setScrollTop,
    setRowHeight,
  ])

  const thumbHeight = hasOverflow
    ? Math.max(20, (viewportHeight * viewportHeight) / totalHeight)
    : 0
  const thumbTop = hasOverflow
    ? (scrollTop / scrollableHeight) * (viewportHeight - thumbHeight)
    : 0

  function handleScrollbarMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const startY = e.clientY
    const startScroll = scrollTop
    const usableTrack = viewportHeight - thumbHeight

    const onMouseMove = (me: MouseEvent) => {
      const dy = me.clientY - startY
      const scrollDelta =
        usableTrack > 0 ? (dy / usableTrack) * scrollableHeight : 0
      const next = Math.max(
        0,
        Math.min(scrollableHeight, startScroll + scrollDelta),
      )
      setScrollTop(next)
    }
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  return { hasOverflow, thumbHeight, thumbTop, handleScrollbarMouseDown }
}
