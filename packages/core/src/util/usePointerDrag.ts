import { useRef } from 'react'

import { useEventCallback } from './useEventCallback.ts'

import type React from 'react'

/**
 * Pointer-capture drag lifecycle shared by draggable UI (resize handles,
 * scrollbars, rubberbands, pan). On pointerdown it captures the pointer on the
 * event's element, so the returned `onPointerMove`/`onPointerUp` fire on that
 * same element even when the pointer leaves it — no window/document listeners,
 * and the capture auto-releases if the element unmounts mid-drag.
 *
 * `onDrag` gets the live React pointer event. React nulls `event.currentTarget`
 * after the handler returns, so snapshot `clientX`/`clientY` (and any target
 * geometry) into locals synchronously before deferring work into a
 * requestAnimationFrame.
 *
 * **One drag belongs to one pointer, and only a primary press starts it.**
 * `pointerdown` fires for a right-click and for every extra finger, and a
 * handler that takes them all reads as two different bugs: a right-press starts
 * a drag that then runs under its own context menu, and a second finger landing
 * mid-drag re-anchors the gesture, so the next move jumps by the distance
 * between the two fingers. Tracking which pointer owns the drag is also what
 * makes the move handler safe, since an uncaptured second pointer over the same
 * element reports moves to it. `usePanZoom` guards its own pan the same way.
 *
 * The caller still owns `touch-action: none` on the element — without it the
 * browser claims a touch drag as a page scroll and no pointer stream arrives at
 * all. It stays a style rather than riding in the returned props because a
 * caller's own `style` would silently replace it.
 */
export function usePointerDrag({
  onDragStart,
  onDrag,
  onDragEnd,
}: {
  onDragStart?: (event: React.PointerEvent) => void
  onDrag: (event: React.PointerEvent) => void
  onDragEnd?: (event: React.PointerEvent) => void
}) {
  const activePointerRef = useRef<number | undefined>(undefined)
  const startStable = useEventCallback((event: React.PointerEvent) => {
    onDragStart?.(event)
  })
  const dragStable = useEventCallback(onDrag)
  const endStable = useEventCallback((event: React.PointerEvent) => {
    onDragEnd?.(event)
  })

  function stop(event: React.PointerEvent) {
    if (activePointerRef.current === event.pointerId) {
      activePointerRef.current = undefined
      endStable(event)
    }
  }

  return {
    onPointerDown: (event: React.PointerEvent) => {
      if (event.button !== 0 || activePointerRef.current !== undefined) {
        return
      }
      activePointerRef.current = event.pointerId
      event.currentTarget.setPointerCapture(event.pointerId)
      startStable(event)
    },
    onPointerMove: (event: React.PointerEvent) => {
      if (activePointerRef.current === event.pointerId) {
        dragStable(event)
      }
    },
    onPointerUp: stop,
    onPointerCancel: stop,
  }
}
