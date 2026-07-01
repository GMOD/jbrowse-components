import { useCallback, useEffect, useMemo } from 'react'

import { createScrollLatch } from './scrollLatch.ts'
import { useEventCallback } from './useEventCallback.ts'
import { normalizeWheelDelta } from './wheelZoom.ts'

export interface VirtualScrollOpts {
  scrollTop: number
  viewportHeight: number
  scrollableHeight: number
}

// Normalize this wheel event to pixels, feed it through the shared scroll
// latch, and return the clamped new scrollTop — or null when the panel stays
// put (fits, or sits at a boundary). The latch owns preventDefault. Pure with
// respect to model state: the caller applies the returned offset via its own
// setScrollTop, so the no-destructure-model-actions rule is preserved.
export type ApplyVirtualScroll = (
  e: WheelEvent,
  opts: VirtualScrollOpts,
) => number | null

// Non-passive wheel wiring for a canvas-backed virtual scroll (no DOM overflow
// container to self-correct). Owns the latch and the listener lifecycle and
// hands the caller an `applyScroll` that runs the latch. The gesture guards
// (scrollZoom, ctrl/meta, shift-to-resize) differ per display and so stay in
// the caller; this centralizes the mechanical latch + listener boilerplate
// shared by the alignments pileup and the variant matrix.
export function useVirtualScrollWheel(
  canvas: HTMLElement | null,
  onWheel: (e: WheelEvent, applyScroll: ApplyVirtualScroll) => void,
) {
  const latch = useMemo(() => createScrollLatch(), [])
  const applyScroll = useCallback<ApplyVirtualScroll>(
    (e, { scrollTop, viewportHeight, scrollableHeight }) => {
      if (scrollableHeight <= 0) {
        return null
      }
      const dy = normalizeWheelDelta(e.deltaY, e.deltaMode, viewportHeight)
      return latch.scroll(e, scrollTop, dy, scrollableHeight)
    },
    [latch],
  )
  const handleWheel = useEventCallback((e: WheelEvent) => {
    onWheel(e, applyScroll)
  })
  useEffect(() => {
    if (!canvas) {
      return undefined
    }
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [canvas, handleWheel])
}
