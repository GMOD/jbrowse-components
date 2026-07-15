import { useCallback, useEffect, useRef } from 'react'

import { useEventCallback } from './useEventCallback.ts'

// Coalesce rapid value writes to a single commit per animation frame. High-
// frequency DOM events (a thumb drag's pointermove, plus the browser's
// coalesced pointer batches) can fire faster than the frame rate; committing
// each synchronously reruns the downstream work — a canvas repaint, an overlay
// reconciliation — several times per frame, all but the last discarded.
//
// Values are absolute, so it's last-write-wins: a later `schedule` in the same
// frame overwrites the pending value. `flush` commits the pending value now
// (e.g. the gesture ended, so the resting position must be exact) and cancels
// the frame; the pending frame is also canceled on unmount so a late commit
// can't fire into a torn-down tree.
export function useRafCommit(commit: (value: number) => void) {
  const stableCommit = useEventCallback(commit)
  const pendingRef = useRef<{ id: number; value: number }>(undefined)
  useEffect(
    () => () => {
      const pending = pendingRef.current
      if (pending) {
        cancelAnimationFrame(pending.id)
      }
    },
    [],
  )
  const schedule = useCallback(
    (value: number) => {
      const pending = pendingRef.current
      if (pending) {
        pending.value = value
      } else {
        pendingRef.current = {
          value,
          id: requestAnimationFrame(() => {
            const cur = pendingRef.current
            pendingRef.current = undefined
            if (cur) {
              stableCommit(cur.value)
            }
          }),
        }
      }
    },
    [stableCommit],
  )
  const flush = useCallback(() => {
    const pending = pendingRef.current
    if (pending) {
      cancelAnimationFrame(pending.id)
      pendingRef.current = undefined
      stableCommit(pending.value)
    }
  }, [stableCommit])
  return { schedule, flush }
}
