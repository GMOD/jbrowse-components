import type React from 'react'
import { useRef } from 'react'

import { useEventCallback } from './useEventCallback.ts'

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
  const draggingRef = useRef(false)
  const startStable = useEventCallback((event: React.PointerEvent) => {
    onDragStart?.(event)
  })
  const dragStable = useEventCallback(onDrag)
  const endStable = useEventCallback((event: React.PointerEvent) => {
    onDragEnd?.(event)
  })

  function stop(event: React.PointerEvent) {
    if (draggingRef.current) {
      draggingRef.current = false
      endStable(event)
    }
  }

  return {
    onPointerDown: (event: React.PointerEvent) => {
      draggingRef.current = true
      event.currentTarget.setPointerCapture(event.pointerId)
      startStable(event)
    },
    onPointerMove: (event: React.PointerEvent) => {
      if (draggingRef.current) {
        dragStable(event)
      }
    },
    onPointerUp: stop,
    onPointerCancel: stop,
  }
}
