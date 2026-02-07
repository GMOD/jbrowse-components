import { useCallback, useEffect, useRef, useState } from 'react'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface UseWebGLViewInteractionProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  view: LinearGenomeViewModel | undefined
  onRender: (domainX: [number, number]) => void
}

/**
 * Reusable hook for WebGL view interaction (smooth pan/zoom)
 *
 * Provides:
 * - Wheel zoom around mouse position
 * - Horizontal wheel pan
 * - Drag to pan
 *
 * Updates view state and calls onRender immediately for smooth interaction.
 */
export function useWebGLViewInteraction({
  canvasRef,
  view,
  onRender,
}: UseWebGLViewInteractionProps) {
  const canvasRectRef = useRef<DOMRect | null>(null)
  const dragRef = useRef({ isDragging: false, lastX: 0 })
  const [isDragging, setIsDragging] = useState(false)

  // Get visible bp range from view state
  const getVisibleBpRange = useCallback((): [number, number] | null => {
    if (!view?.initialized) {
      return null
    }
    const width = view.dynamicBlocks.totalWidthPx
    const contentBlocks = view.dynamicBlocks.contentBlocks
    if (contentBlocks.length === 0) {
      return null
    }
    const first = contentBlocks[0]
    if (!first) {
      return null
    }

    const bpPerPx = view.bpPerPx
    const blockOffsetPx = first.offsetPx
    const deltaPx = view.offsetPx - blockOffsetPx
    const deltaBp = deltaPx * bpPerPx

    const rangeStart = first.start + deltaBp
    const rangeEnd = rangeStart + width * bpPerPx
    return [rangeStart, rangeEnd]
  }, [view])

  // Refs for values used in wheel handler
  const onRenderRef = useRef(onRender)
  const getVisibleBpRangeRef = useRef(getVisibleBpRange)
  const viewRef = useRef(view)

  useEffect(() => {
    onRenderRef.current = onRender
    getVisibleBpRangeRef.current = getVisibleBpRange
    viewRef.current = view
  })

  // Invalidate cached rect when view changes
  useEffect(() => {
    canvasRectRef.current = null
  }, [view?.dynamicBlocks.totalWidthPx])

  // Wheel handler for zoom and pan
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const handleWheel = (e: WheelEvent) => {
      const view = viewRef.current
      if (!view?.initialized) {
        return
      }

      const width = view.dynamicBlocks.totalWidthPx
      const absX = Math.abs(e.deltaX)
      const absY = Math.abs(e.deltaY)

      // Horizontal scroll - pan
      if (absX > 5 && absX > absY * 2) {
        e.preventDefault()
        e.stopPropagation()
        const newOffsetPx = Math.max(
          view.minOffset,
          Math.min(view.maxOffset, view.offsetPx + e.deltaX),
        )

        const contentBlocks = view.dynamicBlocks.contentBlocks
        const first = contentBlocks[0]
        if (first) {
          const blockOffsetPx = first.offsetPx
          const deltaPx = newOffsetPx - blockOffsetPx
          const deltaBp = deltaPx * view.bpPerPx
          const rangeStart = first.start + deltaBp
          const rangeEnd = rangeStart + width * view.bpPerPx

          onRenderRef.current([rangeStart, rangeEnd])
          view.setNewView(view.bpPerPx, newOffsetPx)
        }
        return
      }

      if (absY < 1) {
        return
      }
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [canvasRef])

  // Mouse handlers for drag panning
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    dragRef.current = { isDragging: true, lastX: e.clientX }
    setIsDragging(true)
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragRef.current.isDragging || !view?.initialized) {
        return
      }
      e.stopPropagation()

      const dx = e.clientX - dragRef.current.lastX
      dragRef.current.lastX = e.clientX

      if (dx !== 0) {
        const width = view.dynamicBlocks.totalWidthPx
        const newOffsetPx = Math.max(
          view.minOffset,
          Math.min(view.maxOffset, view.offsetPx - dx),
        )

        const contentBlocks = view.dynamicBlocks.contentBlocks
        const first = contentBlocks[0]
        if (first) {
          const blockOffsetPx = first.offsetPx
          const deltaPx = newOffsetPx - blockOffsetPx
          const deltaBp = deltaPx * view.bpPerPx
          const rangeStart = first.start + deltaBp
          const rangeEnd = rangeStart + width * view.bpPerPx

          onRenderRef.current([rangeStart, rangeEnd])
          view.setNewView(view.bpPerPx, newOffsetPx)
        }
      }
    },
    [view],
  )

  const handleMouseUp = useCallback(() => {
    dragRef.current.isDragging = false
    setIsDragging(false)
  }, [])

  const handleMouseLeave = useCallback(() => {
    dragRef.current.isDragging = false
    setIsDragging(false)
  }, [])

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    isDragging,
    getVisibleBpRange,
  }
}
