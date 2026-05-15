import { useEffect, useState } from 'react'

const MIN_DRAG_DISTANCE = 3

export interface DragRect {
  startX: number
  startY: number
  endX: number
  endY: number
}

export interface ContextCoord extends DragRect {
  coord: [number, number]
}

interface DragState {
  drag?: DragRect
  isDragging: boolean
  showSelectionBox: boolean
  mouse?: { x: number; y: number }
}

function relativeXY(
  ref: React.RefObject<HTMLDivElement | null>,
  e: MouseEvent | React.MouseEvent,
) {
  const rect = ref.current?.getBoundingClientRect()
  return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) }
}

export function useDragSelection(ref: React.RefObject<HTMLDivElement | null>) {
  const [state, setState] = useState<DragState>({
    isDragging: false,
    showSelectionBox: false,
  })
  const [contextCoord, setContextCoord] = useState<ContextCoord>()

  function clearSelectionBox() {
    setState(s => ({ ...s, drag: undefined, showSelectionBox: false }))
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (e.shiftKey) {
      return
    }
    const { x, y } = relativeXY(ref, e)
    setState({
      isDragging: true,
      showSelectionBox: false,
      drag: { startX: x, startY: y, endX: x, endY: y },
      mouse: { x, y },
    })
    e.stopPropagation()
  }

  function handleMouseMove(e: React.MouseEvent) {
    const { x, y } = relativeXY(ref, e)
    setState(s => ({
      ...s,
      mouse: { x, y },
      drag:
        s.isDragging && s.drag ? { ...s.drag, endX: x, endY: y } : s.drag,
    }))
  }

  function handleMouseUp(e: React.MouseEvent) {
    setState(s => {
      if (s.isDragging && s.drag) {
        const dx = Math.abs(s.drag.endX - s.drag.startX)
        if (dx > MIN_DRAG_DISTANCE) {
          const { x, y } = relativeXY(ref, e)
          setContextCoord({
            coord: [e.clientX, e.clientY],
            startX: s.drag.startX,
            startY: s.drag.startY,
            endX: x,
            endY: y,
          })
          return { ...s, isDragging: false, showSelectionBox: true }
        }
      }
      return {
        ...s,
        isDragging: false,
        drag: undefined,
        showSelectionBox: false,
      }
    })
  }

  function handleMouseLeave() {
    setState(s => ({ ...s, mouse: undefined, isDragging: false }))
  }

  useEffect(() => {
    if (!state.showSelectionBox) {
      return
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearSelectionBox()
      }
    }
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        clearSelectionBox()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('click', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [ref, state.showSelectionBox])

  const { drag, mouse, isDragging, showSelectionBox } = state
  const draggedEnough =
    drag !== undefined && Math.abs(drag.endX - drag.startX) > MIN_DRAG_DISTANCE

  return {
    isDragging: isDragging && draggedEnough,
    dragStartX: drag?.startX,
    dragEndX: drag?.endX,
    dragStartY: drag?.startY,
    dragEndY: drag?.endY,
    showSelectionBox,
    mouseX: mouse?.x,
    mouseY: mouse?.y,
    contextCoord,
    setContextCoord,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    clearSelectionBox,
  }
}
