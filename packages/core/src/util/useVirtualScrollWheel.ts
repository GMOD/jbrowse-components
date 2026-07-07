import { useCallback, useEffect, useMemo } from 'react'

import { trackPointerPresence } from './pointerPresence.ts'
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
    // Ignore wheel events the browser keeps latching to this canvas once the
    // pointer has left (see trackPointerPresence): let them chain to the page
    // and reset the latch so the next in-panel gesture starts clean. Without
    // this the panel stays stuck to per-track scroll after the mouse has left —
    // worst in embedded, where the outer page is the thing that should scroll.
    const presence = trackPointerPresence(canvas, () => {
      latch.reset()
    })
    const onWheelNative = (e: WheelEvent) => {
      if (presence.isOver) {
        handleWheel(e)
      }
    }
    canvas.addEventListener('wheel', onWheelNative, { passive: false })
    return () => {
      canvas.removeEventListener('wheel', onWheelNative)
      presence.dispose()
    }
  }, [canvas, handleWheel, latch])
}
