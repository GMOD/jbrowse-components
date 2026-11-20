import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'

export interface PointerGestureHandlers {
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void
  onPointerMove: (event: React.PointerEvent<HTMLElement>) => void
  onPointerUp: (event: React.PointerEvent<HTMLElement>) => void
  onPointerCancel: (event: React.PointerEvent<HTMLElement>) => void
  onLostPointerCapture: (event: React.PointerEvent<HTMLElement>) => void
  onPointerLeave: (event: React.PointerEvent<HTMLElement>) => void
}

export interface PointerGesture<S> {
  /** the gesture's state, or undefined to decline the press */
  start: (event: React.PointerEvent<HTMLElement>) => S | undefined
  move: (state: S, event: React.PointerEvent<HTMLElement>) => void
  /** `completed` is true for a release, false for any way of abandoning it */
  end?: (state: S, completed: boolean) => void
  escapeCancels?: boolean
  /**
   * How far, in px summed over both axes, the pointer travels before `move`
   * runs and the element takes the pointer. A browser sends a captured
   * press's click and double-click to the capturing element, so a gesture
   * on an element with clickable children waits; leaving the element first
   * also starts it.
   */
  slopPx?: number
}

/**
 * One pointer drag, owning the rules every gesture here needs: the primary
 * button of the primary pointer starts it, one `pointerId` steers it, capture
 * routes it, and a cancel, a lost capture or (opted in) Escape abandons it.
 * The handlers are identity-stable, so they can sit in memoised chrome.
 */
export function usePointerGesture<S>(
  gesture: PointerGesture<S>,
): PointerGestureHandlers & { cancel: () => void } {
  const gestureRef = useRef(gesture)
  useLayoutEffect(() => {
    gestureRef.current = gesture
  })
  const activeRef = useRef<
    | {
        pointerId: number
        element: HTMLElement
        state: S
        x: number
        y: number
        captured: boolean
      }
    | undefined
  >(undefined)

  const handlers = useMemo(() => {
    function finish(completed: boolean) {
      const active = activeRef.current
      if (!active) {
        return
      }
      activeRef.current = undefined
      window.removeEventListener('keydown', onKeyDown)
      if (active.element.hasPointerCapture(active.pointerId)) {
        active.element.releasePointerCapture(active.pointerId)
      }
      gestureRef.current.end?.(active.state, completed)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        finish(false)
      }
    }
    function owns(event: React.PointerEvent) {
      return activeRef.current?.pointerId === event.pointerId
    }
    function capture(active: {
      pointerId: number
      element: HTMLElement
      captured: boolean
    }) {
      active.captured = true
      active.element.setPointerCapture(active.pointerId)
    }
    return {
      onPointerDown(event: React.PointerEvent<HTMLElement>) {
        if (event.button !== 0 || !event.isPrimary) {
          return
        }
        finish(false)
        const state = gestureRef.current.start(event)
        if (state === undefined) {
          return
        }
        const active = {
          pointerId: event.pointerId,
          element: event.currentTarget,
          state,
          x: event.clientX,
          y: event.clientY,
          captured: false,
        }
        activeRef.current = active
        if (!gestureRef.current.slopPx) {
          capture(active)
        }
        if (gestureRef.current.escapeCancels) {
          window.addEventListener('keydown', onKeyDown)
        }
      },
      onPointerMove(event: React.PointerEvent<HTMLElement>) {
        const active = activeRef.current
        if (active && owns(event)) {
          if (!active.captured) {
            const travel =
              Math.abs(event.clientX - active.x) +
              Math.abs(event.clientY - active.y)
            if (travel >= (gestureRef.current.slopPx ?? 0)) {
              capture(active)
            }
          }
          if (active.captured) {
            gestureRef.current.move(active.state, event)
          }
        }
      },
      onPointerLeave(event: React.PointerEvent<HTMLElement>) {
        const active = activeRef.current
        if (active && owns(event) && !active.captured) {
          capture(active)
        }
      },
      onPointerUp(event: React.PointerEvent<HTMLElement>) {
        if (owns(event)) {
          finish(true)
        }
      },
      onPointerCancel(event: React.PointerEvent<HTMLElement>) {
        if (owns(event)) {
          finish(false)
        }
      },
      onLostPointerCapture(event: React.PointerEvent<HTMLElement>) {
        if (owns(event)) {
          finish(false)
        }
      },
      cancel() {
        finish(false)
      },
    }
  }, [])

  useEffect(() => handlers.cancel, [handlers])

  return handlers
}
