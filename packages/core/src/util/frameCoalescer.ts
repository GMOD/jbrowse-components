/**
 * One animation frame's worth of scheduling, with the cancel attached.
 *
 * The shape every high-frequency input handler ends up in: the event handler
 * only accumulates — a wheel delta, a scroll offset, a pointer sample — and one
 * `requestAnimationFrame` per frame does the model write, so a burst of events
 * (fast trackpad, inertial scroll, coalesced pointer batches) collapses to one
 * update per frame instead of thrashing the views once per event.
 *
 * It exists for the second half of that, not the first. A pending frame holds a
 * closure over a view that a tab-close, a track-hide or a route change can
 * detach before it runs, and then the flush writes to a destroyed MST node,
 * which throws. Every one of these handlers has to cancel on dispose, and the
 * cancel is the half that is invisible when missing — `useDotplotInteraction`
 * had `scheduled = false` bookkeeping and no `cancelAnimationFrame` for as long
 * as it existed, because nothing about the scheduling side looks incomplete.
 * Here the disposer is the object's own method.
 *
 * **First scheduler of a frame wins.** Later `schedule` calls before the frame
 * runs are no-ops rather than replacing the callback, which is what a caller
 * accumulating into its own state wants: the deltas are already in that state,
 * and the flush reads them when it runs. A caller wanting last-write-wins over
 * a *value* wants `useRafCommit` instead.
 */
export interface FrameCoalescer {
  // `now` is the frame's `DOMHighResTimeStamp`, which callers rate-limiting
  // against elapsed time need and the rest can ignore
  schedule: (flush: (now: number) => void) => void
  cancel: () => void
  // whether a frame is in flight — "is this the first event of a frame", which
  // is where a caller re-syncs its accumulator to live state
  readonly pending: boolean
}

export function createFrameCoalescer(): FrameCoalescer {
  let id: number | null = null
  return {
    schedule(flush) {
      id ??= requestAnimationFrame(now => {
        // cleared before the flush, so a flush that schedules again (a spring,
        // a momentum tail) gets the next frame rather than being swallowed
        id = null
        flush(now)
      })
    },
    cancel() {
      if (id !== null) {
        cancelAnimationFrame(id)
        id = null
      }
    },
    get pending() {
      return id !== null
    },
  }
}
