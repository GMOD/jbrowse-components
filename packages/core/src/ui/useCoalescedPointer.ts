import { useEffect, useRef } from 'react'

import { useEventCallback } from '../util/useEventCallback.ts'

/**
 * Run a pointer handler at most once per frame, on the latest position.
 *
 * `mousemove` arrives far faster than a frame on any modern pointer, so a
 * handler doing real work per raw event is spending most of it on positions the
 * user never sees. The pileup's hit test measured 3.3ms of listener time per
 * event on a 150px canvas — five events into a frame the frame is already gone —
 * and it was the most expensive hover of any display.
 *
 * **Coalescing is only safe because nothing decides anything from a hover.**
 * Click and right-click re-run their own hit test from their own event, which is
 * already the rule (a hover recorded a frame ago must not act), so a hover
 * landing one frame after the cursor is by construction invisible. A gesture
 * that reads the stored hover instead would see this as a lost frame.
 *
 * The **first** scheduled frame is kept and the latest payload read inside it,
 * rather than cancelling and rescheduling per event: both deliver one call per
 * frame, and this one does no cancel churn. (`useMouseTracking` reschedules
 * because it also publishes to a store that a mid-frame leave must be able to
 * clear.)
 *
 * `cancel` is the other half, and it is not optional. A frame queued just before
 * the pointer leaves lands *after* it has gone and re-lights the hover the leave
 * handler just cleared, so a `mouseleave` cancels before clearing. Unmount
 * cancels too — a display is detached from the MST tree before React unmounts
 * it, so a frame landing in between writes onto a dead node.
 *
 * The payload is whatever the caller reads off the event, because where a
 * display's coordinates come from is its own business: a borderless leaf canvas
 * takes `offsetX`/`offsetY`, one with overlays measures a rect. Read it at event
 * time — a React event's fields are gone by the frame.
 */
export function useCoalescedPointer<T>(onFrame: (payload: T) => void) {
  const rafRef = useRef<ReturnType<typeof requestAnimationFrame> | undefined>(
    undefined,
  )
  const payloadRef = useRef<T | undefined>(undefined)
  const runFrame = useEventCallback(onFrame)

  const cancel = useEventCallback(() => {
    if (rafRef.current !== undefined) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = undefined
    }
    payloadRef.current = undefined
  })

  useEffect(() => cancel, [cancel])

  const queue = useEventCallback((payload: T) => {
    payloadRef.current = payload
    if (rafRef.current === undefined) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = undefined
        const latest = payloadRef.current
        if (latest !== undefined) {
          runFrame(latest)
        }
      })
    }
  })

  return { queue, cancel }
}
