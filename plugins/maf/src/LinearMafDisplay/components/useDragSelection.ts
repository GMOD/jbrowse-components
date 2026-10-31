import { useEffect, useState } from 'react'

import { isFromPortal } from '@jbrowse/core/util/pressOwner'

import type { ContextMenuAnchor } from '@jbrowse/core/ui'

const MIN_DRAG_DISTANCE = 3

function movedFarEnough(d: DragRect) {
  return Math.abs(d.endX - d.startX) > MIN_DRAG_DISTANCE
}

export interface DragRect {
  startX: number
  startY: number
  endX: number
  endY: number
}

export interface ContextCoord extends DragRect {
  /** viewport point the subsequence menu opens at */
  anchor: ContextMenuAnchor
}

interface DragState {
  drag?: DragRect
  isDragging: boolean
  showSelectionBox: boolean
}

function relativeXY(
  ref: React.RefObject<HTMLDivElement | null>,
  e: MouseEvent | React.MouseEvent,
) {
  const rect = ref.current?.getBoundingClientRect()
  return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) }
}

export function useDragSelection(
  ref: React.RefObject<HTMLDivElement | null>,
  {
    dataLeft,
    onClick,
  }: {
    /**
     * Left edge of the data area: a press left of this (the tree sidebar and
     * its resize handle) neither clicks nor starts a selection, since the
     * sidebar covers the coordinate under it.
     */
    dataLeft: number
    onClick: (x: number, y: number) => void
  },
) {
  const [state, setState] = useState<DragState>({
    isDragging: false,
    showSelectionBox: false,
  })
  const [contextCoord, setContextCoord] = useState<ContextCoord>()

  function clearSelectionBox() {
    setState(s => ({ ...s, drag: undefined, showSelectionBox: false }))
  }

  // Don't start a selection when the press lands on a control that claimed it
  // (a resize handle, say), or on a right button, whose release opens the
  // context menu.
  function leavesPressToView(e: React.MouseEvent) {
    return (
      e.button > 0 ||
      e.shiftKey ||
      isFromPortal(e) ||
      !!(e.target as Element).closest('[data-gesture-owner]')
    )
  }

  // The LGV pans on pointerdown (useSideScroll), so a press the display keeps
  // is stopped here, including over the sidebar. A touch is left to the view so
  // a finger drag over the rows still pans.
  function handlePointerDown(e: React.PointerEvent) {
    if (e.pointerType !== 'touch' && !leavesPressToView(e)) {
      e.stopPropagation()
    }
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (leavesPressToView(e)) {
      return
    }
    const { x, y } = relativeXY(ref, e)
    // the view's range select listens for mousedown on the same container
    e.stopPropagation()
    if (x >= dataLeft) {
      setState({
        isDragging: true,
        showSelectionBox: false,
        drag: { startX: x, startY: y, endX: x, endY: y },
      })
    }
  }

  // Only a live drag writes state here. The hover position comes from the
  // chrome's `mouseTracker` (see `useMouseTracking`), so a plain move does not
  // re-render the component that renders `DisplayChrome`.
  function handleMouseMove(e: React.MouseEvent) {
    // The early return keeps a plain hover free of `setState` and
    // `getBoundingClientRect`. The updater re-tests its own state and returns
    // `s` unchanged without a drag, which React bails out of.
    if (!state.isDragging) {
      return
    }
    const { x, y } = relativeXY(ref, e)
    setState(s =>
      s.isDragging && s.drag
        ? { ...s, drag: { ...s.drag, endX: x, endY: y } }
        : s,
    )
  }

  function handleMouseUp(e: React.MouseEvent) {
    // Decide outside the setState updater so it stays pure (React strict mode
    // double-invokes updaters).
    const { drag, isDragging } = state
    const draggedFar = isDragging && drag !== undefined && movedFarEnough(drag)
    if (draggedFar) {
      const { x, y } = relativeXY(ref, e)
      setContextCoord({
        anchor: { clientX: e.clientX, clientY: e.clientY },
        startX: drag.startX,
        startY: drag.startY,
        endX: x,
        endY: y,
      })
      setState(s => ({ ...s, isDragging: false, showSelectionBox: true }))
    } else if (isDragging) {
      // Only a release that this display saw the press for is a click:
      // `handleMouseDown` bails on resize handles and the tree sidebar.
      const { x, y } = relativeXY(ref, e)
      onClick(x, y)
      setState(s => ({
        ...s,
        isDragging: false,
        drag: undefined,
        showSelectionBox: false,
      }))
    }
  }

  function handleMouseLeave() {
    setState(s => ({ ...s, isDragging: false }))
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

  const { drag, isDragging, showSelectionBox } = state
  const dragging = isDragging && drag !== undefined && movedFarEnough(drag)

  return {
    isDragging: dragging,
    /**
     * The rubberband rect to draw, or undefined. This hook owns when a
     * selection is live, and the corners are present or absent together.
     */
    selectionRect: dragging || showSelectionBox ? drag : undefined,
    showSelectionBox,
    contextCoord,
    setContextCoord,
    handlePointerDown,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    clearSelectionBox,
  }
}
