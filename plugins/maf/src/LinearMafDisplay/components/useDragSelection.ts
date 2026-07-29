import { useEffect, useState } from 'react'

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
  coord: [number, number]
}

/** The cursor in both coordinate systems the display needs it in. */
export interface MousePos {
  /** display-relative px, for hit-testing and the crosshairs */
  x: number
  y: number
  /** viewport-relative px, for floating-ui's controlled client point */
  clientX: number
  clientY: number
}

interface DragState {
  drag?: DragRect
  isDragging: boolean
  showSelectionBox: boolean
  mouse?: MousePos
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
     * Left edge of the data area: a press at or left of this (the tree sidebar
     * and its resize handle) neither clicks nor starts a selection, because the
     * genomic coordinate under it is the one the sidebar is covering. Without
     * it, clicking a tree node also opened a feature widget for the row beneath
     * it, and a drag begun over the sidebar produced a subsequence menu for
     * coordinates the user can't see.
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

  function handleMouseDown(e: React.MouseEvent) {
    // Don't start a selection when the press lands on a control that claimed it
    // (a resize handle, say): the container owns this invariant, so controls
    // dropped into the chrome are non-selectable without each one needing to
    // stopPropagation.
    if (e.shiftKey || (e.target as Element).closest('[data-gesture-owner]')) {
      return
    }
    const { x, y } = relativeXY(ref, e)
    // Swallow the press wherever it lands in the display, including over the
    // sidebar: DisplayChrome spreads these handlers onto a div inside the LGV's
    // TracksContainer, so an un-stopped mousedown starts the view's click-drag
    // pan. Only the data area additionally begins a selection.
    e.stopPropagation()
    if (x > dataLeft) {
      setState({
        isDragging: true,
        showSelectionBox: false,
        drag: { startX: x, startY: y, endX: x, endY: y },
        mouse: { x, y, clientX: e.clientX, clientY: e.clientY },
      })
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    const { x, y } = relativeXY(ref, e)
    setState(s => ({
      ...s,
      mouse: { x, y, clientX: e.clientX, clientY: e.clientY },
      drag: s.isDragging && s.drag ? { ...s.drag, endX: x, endY: y } : s.drag,
    }))
  }

  function handleMouseUp(e: React.MouseEvent) {
    // Decide outside the setState updater so the updater stays pure
    // (React strict mode double-invokes updaters).
    const { drag, isDragging } = state
    const draggedFar = isDragging && drag !== undefined && movedFarEnough(drag)
    if (draggedFar) {
      const { x, y } = relativeXY(ref, e)
      setContextCoord({
        coord: [e.clientX, e.clientY],
        startX: drag.startX,
        startY: drag.startY,
        endX: x,
        endY: y,
      })
      setState(s => ({ ...s, isDragging: false, showSelectionBox: true }))
    } else if (isDragging) {
      // Only a release that this display also saw the press for is a click.
      // `handleMouseDown` bails on resize handles and on the tree sidebar, so
      // without the `isDragging` test, releasing a band/sidebar resize drag over
      // an insertion marker opened its feature widget.
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
  // A press that hasn't travelled is a click, not a selection.
  const dragging = isDragging && drag !== undefined && movedFarEnough(drag)

  return {
    isDragging: dragging,
    /**
     * The rubberband rect to draw, or undefined when there is nothing to show.
     * Resolved here rather than by the consumer re-testing `isDragging`,
     * `showSelectionBox` and each of the rect's four corners for undefined —
     * this hook owns when a selection is live, and the corners are only ever
     * present or absent together.
     */
    selectionRect: dragging || showSelectionBox ? drag : undefined,
    showSelectionBox,
    /** undefined when the cursor is outside the display */
    mouse,
    contextCoord,
    setContextCoord,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    clearSelectionBox,
  }
}
