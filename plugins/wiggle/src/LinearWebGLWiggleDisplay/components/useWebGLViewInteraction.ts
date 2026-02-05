import { useCallback, useEffect, useRef } from 'react'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface UseWebGLViewInteractionProps {
  canvasRef: React.RefObject<HTMLCanvasElement>
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

  // Get visible bp range from view state
  const getVisibleBpRange = useCallback((): [number, number] | null => {
    if (!view?.initialized) {
      return null
    }
    const width = view.dynamicBlocks.totalWidthPx
    const contentBlocks = view.dynamicBlocks.contentBlocks
    if (!contentBlocks || contentBlocks.length === 0) {
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
  onRenderRef.current = onRender
  const getVisibleBpRangeRef = useRef(getVisibleBpRange)
  getVisibleBpRangeRef.current = getVisibleBpRange
  const viewRef = useRef(view)
  viewRef.current = view

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

      e.preventDefault()
      e.stopPropagation()

      const width = view.dynamicBlocks.totalWidthPx
      const absX = Math.abs(e.deltaX)
      const absY = Math.abs(e.deltaY)

      // Horizontal scroll - pan
      if (absX > 5 && absX > absY * 2) {
        const newOffsetPx = Math.max(
          view.minOffset,
          Math.min(view.maxOffset, view.offsetPx + e.deltaX),
        )

        const contentBlocks = view.dynamicBlocks.contentBlocks
        const first = contentBlocks?.[0]
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

      // Zoom around mouse position
      const currentRange = getVisibleBpRangeRef.current()
      if (!currentRange) {
        return
      }

      let rect = canvasRectRef.current
      if (!rect) {
        rect = canvas.getBoundingClientRect()
        canvasRectRef.current = rect
      }
      const mouseX = e.clientX - rect.left
      const factor = 1.2
      const zoomFactor = e.deltaY > 0 ? factor : 1 / factor

      const rangeWidth = currentRange[1] - currentRange[0]
      const mouseFraction = mouseX / width
      const mouseBp = currentRange[0] + rangeWidth * mouseFraction

      const newRangeWidth = rangeWidth * zoomFactor
      const newBpPerPx = newRangeWidth / width

      if (newBpPerPx < view.minBpPerPx || newBpPerPx > view.maxBpPerPx) {
        return
      }

      const newRangeStart = mouseBp - mouseFraction * newRangeWidth
      const newRangeEnd = newRangeStart + newRangeWidth

      const contentBlocks = view.dynamicBlocks.contentBlocks
      const first = contentBlocks?.[0]
      if (first) {
        const blockOffsetPx = first.offsetPx
        const assemblyOrigin = first.start - blockOffsetPx * view.bpPerPx
        const newOffsetPx = (newRangeStart - assemblyOrigin) / newBpPerPx

        onRenderRef.current([newRangeStart, newRangeEnd])
        view.setNewView(newBpPerPx, newOffsetPx)
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
        const first = contentBlocks?.[0]
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
  }, [])

  const handleMouseLeave = useCallback(() => {
    dragRef.current.isDragging = false
  }, [])

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    isDragging: dragRef.current.isDragging,
    getVisibleBpRange,
  }
}
