import { useEffect, useRef } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'

export const useScrollbarStyles = makeStyles()({
  scrollbarTrack: {
    position: 'absolute' as const,
    right: 0,
    width: 12,
    cursor: 'default',
    zIndex: 10,
    '&:hover > *': {
      background: 'rgba(0,0,0,0.55)',
    },
  },
  scrollbarThumb: {
    position: 'absolute' as const,
    right: 2,
    width: 6,
    borderRadius: 3,
    background: 'rgba(0,0,0,0.3)',
    pointerEvents: 'none' as const,
  },
})

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

  const scrollTopRef = useRef(scrollTop)
  scrollTopRef.current = scrollTop
  const setScrollTopRef = useRef(setScrollTop)
  setScrollTopRef.current = setScrollTop
  const rowHeightRef = useRef(rowHeight)
  rowHeightRef.current = rowHeight
  const setRowHeightRef = useRef(setRowHeight)
  setRowHeightRef.current = setRowHeight

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const handler = (e: WheelEvent) => {
      if (e.shiftKey) {
        e.preventDefault()
        const curRowHeight = rowHeightRef.current
        const delta = e.deltaY > 0 ? -1 : 1
        const minRowHeight = viewportHeight / nrow
        const newRowHeight = Math.min(20, Math.max(minRowHeight, curRowHeight + delta))
        const rect = canvas.getBoundingClientRect()
        const mouseY = e.clientY - rect.top
        const rowUnderMouse = (mouseY + scrollTopRef.current) / curRowHeight
        const newScrollTop = Math.max(
          0,
          rowUnderMouse * newRowHeight - mouseY,
        )
        setRowHeightRef.current(newRowHeight)
        setScrollTopRef.current(newScrollTop)
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
      const cur = scrollTopRef.current
      const next = Math.max(0, Math.min(scrollableHeight, cur + dy))
      if (next !== cur) {
        e.preventDefault()
        setScrollTopRef.current(next)
      }
    }
    canvas.addEventListener('wheel', handler, { passive: false })
    return () => {
      canvas.removeEventListener('wheel', handler)
    }
  }, [canvasRef, scrollableHeight, viewportHeight, scrollZoom, nrow])

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
