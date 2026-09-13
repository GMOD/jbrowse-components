import { useEffect, useMemo, useRef } from 'react'

import { createFrameCoalescer } from './frameCoalescer.ts'
import { trackPointerPresence } from './pointerPresence.ts'
import { createScrollLatch } from './scrollLatch.ts'
import { useEventCallback } from './useEventCallback.ts'
import { normalizeWheelDelta } from './wheelZoom.ts'

/**
 * What a virtually scrolled panel reads and writes. `TrackHeightMixin`
 * implements it, so a display passes itself.
 */
export interface VirtualScrollModel {
  scrollTop: number
  /** 0 when the content fits; never sub-pixel */
  scrollableHeight: number
  scrollViewportHeight: number
  setScrollTop: (scrollTop: number) => void
}

// An owner that IS the panel (the scrollbar binds this hook to its own marked
// track) or sits ABOVE it (`TrackContainer` marks its whole overlay layer) does
// not count.
function claimedInside(panel: HTMLElement, target: EventTarget | null) {
  const owner =
    target instanceof Element ? target.closest('[data-gesture-owner]') : null
  return owner !== null && owner !== panel && panel.contains(owner)
}

/**
 * Non-passive wheel wiring for a canvas-backed virtual scroll. Owns the scroll
 * latch (and so `preventDefault`), per-frame coalescing of `setScrollTop`, and
 * the listener lifecycle. `onWheel` decides what the gesture means and calls
 * `scroll` when it means scrolling `model`.
 *
 * **Bind this to the panel, not to the `<canvas>`.** A canvas holds no DOM
 * children, so the clickable overlays drawn over it are siblings, and a wheel
 * over one never reaches a listener on the canvas. Overlays that run their own
 * gestures opt out with `[data-gesture-owner]`.
 */
export function useVirtualScrollWheel(
  panel: HTMLElement | null,
  model: VirtualScrollModel,
  onWheel: (e: WheelEvent, scroll: () => void, panel: HTMLElement) => void,
) {
  const latch = useMemo(() => createScrollLatch(), [])
  const frame = useMemo(() => createFrameCoalescer(), [])
  // The offset as it advances across one frame's events, so the latch sees
  // every delta before the model has committed any of them.
  const runningRef = useRef(0)
  const handleWheel = useEventCallback((e: WheelEvent, el: HTMLElement) => {
    onWheel(
      e,
      () => {
        // A sideways-dominant gesture is the view's pan unless this panel has
        // already latched it; ties go vertical, as in the view.
        const sideways = Math.abs(e.deltaX) > Math.abs(e.deltaY)
        const { scrollableHeight, scrollViewportHeight } = model
        if (scrollableHeight <= 0 || (sideways && !latch.holds(e))) {
          return
        }
        if (!frame.pending) {
          runningRef.current = model.scrollTop
        }
        const dy = normalizeWheelDelta(
          e.deltaY,
          e.deltaMode,
          scrollViewportHeight,
        )
        const next = latch.scroll(e, runningRef.current, dy, scrollableHeight)
        if (next !== null) {
          runningRef.current = next
          frame.schedule(() => {
            model.setScrollTop(runningRef.current)
          })
        }
      },
      el,
    )
  })
  useEffect(() => {
    if (!panel) {
      return undefined
    }
    // The browser keeps targeting a gesture at the element it began on after
    // the pointer leaves; release those to the page.
    const presence = trackPointerPresence(panel, () => {
      latch.reset()
    })
    const onWheelNative = (e: WheelEvent) => {
      if (presence.isOver && !claimedInside(panel, e.target)) {
        handleWheel(e, panel)
      }
    }
    panel.addEventListener('wheel', onWheelNative, { passive: false })
    return () => {
      panel.removeEventListener('wheel', onWheelNative)
      presence.dispose()
      frame.cancel()
    }
  }, [panel, handleWheel, latch, frame])
}
