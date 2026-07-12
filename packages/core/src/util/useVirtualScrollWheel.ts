import { useCallback, useEffect, useMemo, useRef } from 'react'

import { trackPointerPresence } from './pointerPresence.ts'
import { createScrollLatch } from './scrollLatch.ts'
import { useEventCallback } from './useEventCallback.ts'
import { normalizeWheelDelta } from './wheelZoom.ts'

export interface VirtualScrollOpts {
  scrollTop: number
  viewportHeight: number
  scrollableHeight: number
}

// Feed this wheel event through the shared scroll latch (which owns
// preventDefault, synchronously) and, when the panel moves, coalesce the new
// scrollTop into a single per-frame `commit`. Bursts of wheel events (fast
// trackpad/momentum scrolling fire well above the frame rate) thus drive at
// most one `commit` — i.e. one model write and one canvas repaint — per
// animation frame, instead of one synchronous repaint per event. Pure with
// respect to model state: the caller applies the committed offset via its own
// setScrollTop, so the no-destructure-model-actions rule is preserved. Mirrors
// the rAF coalescing the horizontal path already does in `useWheelScroll`.
export type ApplyVirtualScroll = (
  e: WheelEvent,
  opts: VirtualScrollOpts,
  commit: (scrollTop: number) => void,
) => void

// Per-frame scroll accumulator. `running` is the latched scroll position as it
// advances across one frame's events; the latch reads it (not the model) each
// event so its boundary/preventDefault decision sees monotonically advancing
// offsets and no delta is lost to a not-yet-committed model read. Re-synced to
// the model's live scrollTop at each fresh frame (`rafId === null`), picking up
// any scroll that happened between frames.
interface ScrollFrame {
  rafId: number | null
  running: number
}

// Non-passive wheel wiring for a canvas-backed virtual scroll (no DOM overflow
// container to self-correct). Owns the latch, the per-frame coalescing, and the
// listener lifecycle, and hands the caller an `applyScroll` that runs the latch
// + schedules the commit. The gesture guards (scrollZoom, ctrl/meta,
// shift-to-resize) differ per display and so stay in the caller; this
// centralizes the mechanical latch + listener + rAF boilerplate shared by the
// alignments pileup, the variant matrix, and the canvas display.
export function useVirtualScrollWheel(
  canvas: HTMLElement | null,
  onWheel: (e: WheelEvent, applyScroll: ApplyVirtualScroll) => void,
) {
  const latch = useMemo(() => createScrollLatch(), [])
  const frameRef = useRef<ScrollFrame>({ rafId: null, running: 0 })
  const applyScroll = useCallback<ApplyVirtualScroll>(
    (e, { scrollTop, viewportHeight, scrollableHeight }, commit) => {
      if (scrollableHeight <= 0) {
        return
      }
      const f = frameRef.current
      // A fresh frame (nothing pending) re-syncs to the model's live scrollTop;
      // within a frame `running` keeps advancing from the last latched offset.
      if (f.rafId === null) {
        f.running = scrollTop
      }
      const dy = normalizeWheelDelta(e.deltaY, e.deltaMode, viewportHeight)
      const next = latch.scroll(e, f.running, dy, scrollableHeight)
      if (next !== null) {
        f.running = next
        // The first move of a frame schedules the commit; later moves only
        // advance `running`, so the frame ends with a single setScrollTop (one
        // repaint) carrying the accumulated offset.
        f.rafId ??= requestAnimationFrame(() => {
          f.rafId = null
          commit(f.running)
        })
      }
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
    // The ref object is identity-stable (only its fields are mutated), so this
    // captured reference reads the live rafId at cleanup time.
    const f = frameRef.current
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
      if (f.rafId !== null) {
        cancelAnimationFrame(f.rafId)
        f.rafId = null
      }
    }
  }, [canvas, handleWheel, latch])
}
