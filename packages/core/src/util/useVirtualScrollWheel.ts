import { useCallback, useEffect, useMemo, useRef } from 'react'

import { createFrameCoalescer } from './frameCoalescer.ts'
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
// the rAF coalescing the horizontal path already does in `useSideScroll`.
export type ApplyVirtualScroll = (
  e: WheelEvent,
  opts: VirtualScrollOpts,
  commit: (scrollTop: number) => void,
) => void

// Non-passive wheel wiring for a canvas-backed virtual scroll (no DOM overflow
// container to self-correct). Owns the latch, the per-frame coalescing, and the
// listener lifecycle, and hands the caller an `applyScroll` that runs the latch
// + schedules the commit. The gesture guards (scrollZoom, ctrl/meta,
// shift-to-resize) differ per display and so stay in the caller; this
// centralizes the mechanical latch + listener + rAF boilerplate shared by the
// alignments pileup, the variant matrix, and the canvas display.
export function useVirtualScrollWheel(
  canvas: HTMLElement | null,
  // `el` is the element the listener is bound to, handed back non-null: a
  // gesture measuring against its own box (the row-resize pin) would otherwise
  // re-assert the nullable it was passed, at the one call site that cannot be
  // reached with a null.
  onWheel: (
    e: WheelEvent,
    applyScroll: ApplyVirtualScroll,
    el: HTMLElement,
  ) => void,
) {
  const latch = useMemo(() => createScrollLatch(), [])
  const frame = useMemo(() => createFrameCoalescer(), [])
  // The latched scroll position as it advances across one frame's events. The
  // latch reads this, not the model, so its boundary/preventDefault decision
  // sees monotonically advancing offsets and no delta is lost to a
  // not-yet-committed model read.
  const runningRef = useRef(0)
  const applyScroll = useCallback<ApplyVirtualScroll>(
    (e, { scrollTop, viewportHeight, scrollableHeight }, commit) => {
      if (scrollableHeight <= 0) {
        return
      }
      // A fresh frame (nothing pending) re-syncs to the model's live scrollTop;
      // within a frame `running` keeps advancing from the last latched offset.
      if (!frame.pending) {
        runningRef.current = scrollTop
      }
      const dy = normalizeWheelDelta(e.deltaY, e.deltaMode, viewportHeight)
      const next = latch.scroll(e, runningRef.current, dy, scrollableHeight)
      if (next !== null) {
        runningRef.current = next
        // The first move of a frame schedules the commit; later moves only
        // advance `running`, so the frame ends with a single setScrollTop (one
        // repaint) carrying the accumulated offset.
        frame.schedule(() => {
          commit(runningRef.current)
        })
      }
    },
    [latch, frame],
  )
  const handleWheel = useEventCallback((e: WheelEvent, el: HTMLElement) => {
    onWheel(e, applyScroll, el)
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
        handleWheel(e, canvas)
      }
    }
    canvas.addEventListener('wheel', onWheelNative, { passive: false })
    return () => {
      canvas.removeEventListener('wheel', onWheelNative)
      presence.dispose()
      frame.cancel()
    }
  }, [canvas, handleWheel, latch, frame])
}
