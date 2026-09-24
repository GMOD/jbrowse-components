import { useEffect } from 'react'

import { useEventCallback } from '@jbrowse/core/util/useEventCallback'

import type React from 'react'

export interface DragEnd {
  startX: number
  endX: number
  isClick: boolean
  clientX: number
  clientY: number
}

/**
 * Follow a press that began at `startX` (px from `ref`'s left edge) through
 * window events until it ends, so the pointer can leave the element mid-drag.
 * A release within 3px of the press is a click. Undefined `startX` is no drag.
 */
export function useWindowDrag(
  ref: React.RefObject<HTMLElement | null>,
  startX: number | undefined,
  handlers: {
    onMove: (x: number) => void
    onEnd: (end: DragEnd) => void
    onCancel: () => void
  },
) {
  const onMove = useEventCallback(handlers.onMove)
  const onEnd = useEventCallback(handlers.onEnd)
  const onCancel = useEventCallback(handlers.onCancel)

  useEffect(() => {
    const el = ref.current
    if (startX === undefined || !el) {
      return
    }
    const { left } = el.getBoundingClientRect()

    const mouseMove = (event: MouseEvent) => {
      onMove(event.clientX - left)
    }
    const mouseUp = ({ clientX, clientY }: MouseEvent) => {
      const endX = clientX - left
      onEnd({
        startX,
        endX,
        isClick: Math.abs(endX - startX) <= 3,
        clientX,
        clientY,
      })
    }
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel()
      }
    }

    window.addEventListener('mousemove', mouseMove)
    window.addEventListener('mouseup', mouseUp)
    window.addEventListener('keydown', keyDown)
    return () => {
      window.removeEventListener('mousemove', mouseMove)
      window.removeEventListener('mouseup', mouseUp)
      window.removeEventListener('keydown', keyDown)
    }
  }, [ref, startX, onMove, onEnd, onCancel])
}
