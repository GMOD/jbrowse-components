import { useCallback, useRef, useState } from 'react'

export default function useDraggable(dragHandleSelector: string) {
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const ref = useRef<HTMLDivElement>(null)

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement
      // Only start drag if clicking on the handle and not on interactive elements
      if (
        !target.closest(dragHandleSelector) ||
        target.closest('button, input, [class*="MuiDialogContent"]')
      ) {
        return
      }

      e.preventDefault()
      const startX = e.clientX
      const startY = e.clientY
      const startOffset = { ...offset }

      function onMouseMove(e: MouseEvent) {
        setOffset({
          x: startOffset.x + (e.clientX - startX),
          y: startOffset.y + (e.clientY - startY),
        })
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [dragHandleSelector, offset],
  )

  return {
    ref,
    style: {
      transform: `translate(${offset.x}px, ${offset.y}px)`,
    },
    onMouseDown,
  }
}
