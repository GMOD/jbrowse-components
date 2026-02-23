import { useEffect, useRef, useState } from 'react'

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
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  scrollTop: number
  setScrollTop: (n: number) => void
  totalHeight: number
  viewportHeight: number
  scrollZoom: boolean
}) {
  const scrollableHeight = Math.max(0, totalHeight - viewportHeight)
  const hasOverflow = scrollableHeight > 0
  const [isDragging, setIsDragging] = useState(false)

  const scrollTopRef = useRef(scrollTop)
  scrollTopRef.current = scrollTop

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const handler = (e: WheelEvent) => {
      if (scrollZoom && !e.shiftKey) {
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
        setScrollTop(next)
      }
    }
    canvas.addEventListener('wheel', handler, { passive: false })
    return () => {
      canvas.removeEventListener('wheel', handler)
    }
  }, [canvasRef, scrollableHeight, viewportHeight, setScrollTop, scrollZoom])

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
    setIsDragging(true)

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
      setIsDragging(false)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  return { hasOverflow, thumbHeight, thumbTop, handleScrollbarMouseDown, isDragging }
}
