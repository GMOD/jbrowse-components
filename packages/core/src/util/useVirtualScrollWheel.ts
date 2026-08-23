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

// Whether the wheel landed inside something within the panel that runs its own
// gestures — JBrowse's `[data-gesture-owner]` marker, the same one the LGV's
// click-drag pan and MAF's drag-selection test for. A panel spans its overlays
// now, and a few of those are controls rather than content: the display's own
// `VerticalScrollbar` (which scrolls the panel itself, from its own listener),
// the pileup's band resize handles, a floating legend. Those keep the gesture
// they already had instead of being absorbed the moment the panel grew to cover
// them.
//
// The marker element ITSELF is a panel at the one call site that is one — the
// scrollbar binds this hook to its own marked track — so an owner that IS the
// panel does not count. Nor does one ABOVE it: `TrackContainer` stamps the
// marker once for its whole overlay layer, and `closest` walking out of the
// panel into that would otherwise disown every wheel a display gets.
function claimedInside(panel: HTMLElement, target: EventTarget | null) {
  const owner =
    target instanceof Element ? target.closest('[data-gesture-owner]') : null
  return owner !== null && owner !== panel && panel.contains(owner)
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
//
// **Bind this to the panel, not to the `<canvas>`.** A canvas cannot hold DOM
// children, so every overlay a display draws over it — floating feature labels,
// group chips, sashimi arcs — is a positioned SIBLING, and the ones that answer
// the pointer (`pointerEvents: 'auto'`, because they are clickable) are what a
// wheel event over them targets. That event bubbles past the canvas entirely, so
// a listener bound to the canvas never sees it and the gesture falls through to
// the page mid-scroll. Bound to the element containing both, the wheel is the
// panel's wherever inside it the cursor happens to be. `trackPointerPresence`
// below keys off the same element, and `mouseenter`/`mouseleave` ignore
// descendant transitions — so crossing onto an overlay no longer reads as
// leaving the panel either.
//
// What keeps a panel safe to widen is `claimedInside` above: it covers its
// overlays, and yields the ones that run gestures of their own.
export function useVirtualScrollWheel(
  panel: HTMLElement | null,
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
    if (!panel) {
      return undefined
    }
    // Ignore wheel events the browser keeps latching to this panel once the
    // pointer has left (see trackPointerPresence): let them chain to the page
    // and reset the latch so the next in-panel gesture starts clean. Without
    // this the panel stays stuck to per-track scroll after the mouse has left —
    // worst in embedded, where the outer page is the thing that should scroll.
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
