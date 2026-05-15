import { useCallback, useEffect, useState } from 'react'

const MIN_DRAG_DISTANCE = 3

interface DragSelectionState {
  isDragging: boolean
  dragStartX: number | undefined
  dragEndX: number | undefined
  dragStartY: number | undefined
  dragEndY: number | undefined
  showSelectionBox: boolean
  mouseX: number | undefined
  mouseY: number | undefined
}

interface DragSelectionHandlers {
  handleMouseDown: (event: React.MouseEvent) => void
  handleMouseMove: (event: React.MouseEvent) => void
  handleMouseUp: (event: React.MouseEvent) => void
  handleMouseLeave: () => void
  clearSelectionBox: () => void
}

interface ContextCoord {
  coord: [number, number]
  dragStartX: number
  dragEndX: number
  dragStartY: number
  dragEndY: number
}

export function useDragSelection(
  ref: React.RefObject<HTMLDivElement | null>,
): DragSelectionState &
  DragSelectionHandlers & {
    contextCoord: ContextCoord | undefined
    setContextCoord: (coord: ContextCoord | undefined) => void
  } {
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartX, setDragStartX] = useState<number>()
  const [dragEndX, setDragEndX] = useState<number>()
  const [dragStartY, setDragStartY] = useState<number>()
  const [dragEndY, setDragEndY] = useState<number>()
  const [showSelectionBox, setShowSelectionBox] = useState(false)
  const [mouseX, setMouseX] = useState<number>()
  const [mouseY, setMouseY] = useState<number>()
  const [contextCoord, setContextCoord] = useState<ContextCoord>()

  const clearSelectionBox = useCallback(() => {
    setShowSelectionBox(false)
    setDragStartX(undefined)
    setDragEndX(undefined)
    setDragStartY(undefined)
    setDragEndY(undefined)
  }, [])

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (event.shiftKey) {
        return
      }
      const rect = ref.current?.getBoundingClientRect()
      const left = rect?.left ?? 0
      const top = rect?.top ?? 0
      const clientX = event.clientX - left
      const clientY = event.clientY - top

      setShowSelectionBox(false)
      setIsDragging(true)
      setDragStartX(clientX)
      setDragEndX(clientX)
      setDragStartY(clientY)
      setDragEndY(clientY)
      event.stopPropagation()
    },
    [ref],
  )

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      const rect = ref.current?.getBoundingClientRect()
      const top = rect?.top ?? 0
      const left = rect?.left ?? 0
      const clientX = event.clientX - left
      const clientY = event.clientY - top

      setMouseY(clientY)
      setMouseX(clientX)

      if (isDragging) {
        setDragEndX(clientX)
        setDragEndY(clientY)
      }
    },
    [ref, isDragging],
  )

  const handleMouseUp = useCallback(
    (event: React.MouseEvent) => {
      if (
        isDragging &&
        dragStartX !== undefined &&
        dragEndX !== undefined &&
        dragStartY !== undefined &&
        dragEndY !== undefined
      ) {
        const dragDistanceX = Math.abs(dragEndX - dragStartX)

        if (dragDistanceX > MIN_DRAG_DISTANCE) {
          const rect = ref.current?.getBoundingClientRect()
          const left = rect?.left ?? 0
          const top = rect?.top ?? 0
          setContextCoord({
            coord: [event.clientX, event.clientY],
            dragEndX: event.clientX - left,
            dragStartX,
            dragStartY,
            dragEndY: event.clientY - top,
          })
          setShowSelectionBox(true)
        } else {
          clearSelectionBox()
        }
      }
      setIsDragging(false)
    },
    [
      ref,
      isDragging,
      dragStartX,
      dragEndX,
      dragStartY,
      dragEndY,
      clearSelectionBox,
    ],
  )

  const handleMouseLeave = useCallback(() => {
    setMouseY(undefined)
    setMouseX(undefined)
    setIsDragging(false)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showSelectionBox) {
        clearSelectionBox()
      }
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (
        ref.current &&
        !ref.current.contains(event.target as Node) &&
        showSelectionBox
      ) {
        clearSelectionBox()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('click', handleClickOutside)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [ref, showSelectionBox, clearSelectionBox])

  const dragDistance =
    dragStartX !== undefined && dragEndX !== undefined
      ? Math.abs(dragEndX - dragStartX)
      : 0
  const hasDraggedEnough = dragDistance > MIN_DRAG_DISTANCE

  return {
    isDragging: isDragging && hasDraggedEnough,
    dragStartX,
    dragEndX,
    dragStartY,
    dragEndY,
    showSelectionBox,
    mouseX,
    mouseY,
    contextCoord,
    setContextCoord,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    clearSelectionBox,
  }
}
