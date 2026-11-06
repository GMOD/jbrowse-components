import { useEffect, useState } from 'react'

import { eventPoint } from '@jbrowse/core/util/eventPoint'
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

/**
 * The pointer clamped into the data area: right of `dataLeft`, where the
 * sidebar stops covering the bases under it, and inside the track.
 */
function pointInData(e: React.MouseEvent, dataLeft: number) {
  const { x, y } = eventPoint(e)
  const { width, height } = e.currentTarget.getBoundingClientRect()
  return { x: clamp(x, dataLeft, width), y: clamp(y, 0, height) }
}

/**
 * Whether the hover crosshair and tooltip belong at `mouse` (display-relative
 * px). A captured drag keeps reporting the pointer past the track, where they
 * stop, as they did when leaving the track ended the drag.
 */
export function showsHoverAt(
  mouse: { x: number; y: number },
  track: { dataLeft: number; width: number; height: number },
  isDragging: boolean,
) {
  return (
    mouse.x >= track.dataLeft &&
    (!isDragging ||
      (mouse.x <= track.width && mouse.y >= 0 && mouse.y <= track.height))
  )
}

export function useDragSelection(
  ref: React.RefObject<HTMLDivElement | null>,
  {
    dataLeft,
    onClick,
  }: {
    /**
     * Left edge of the data area, the model's `dataLeft`: a press left of
     * this (the tree sidebar and its resize handle) neither clicks nor starts
     * a selection, and a drag carried over the sidebar stops at it, since the
     * sidebar covers the bases under it.
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
      (e.target instanceof Element &&
        e.target.closest('[data-gesture-owner]') !== null)
    )
  }

  // The LGV pans on pointerdown (useSideScroll), so a press the display keeps
  // is stopped here, including over the sidebar. A touch is left to the view so
  // a finger drag over the rows still pans.
  //
  // A press in the data area is captured, so the move and release events keep
  // coming when the drag overshoots the track, even if the first move already
  // lands outside it, and the selection is clamped to the data area. Controls
  // in the data area (scrollbar, band handles, corner indicators) carry
  // `data-gesture-owner`, which `leavesPressToView` honours, and the mouse
  // events that make a click fire on the container either way.
  function handlePointerDown(e: React.PointerEvent) {
    if (e.pointerType !== 'touch' && !leavesPressToView(e)) {
      e.stopPropagation()
      if (eventPoint(e).x >= dataLeft) {
        e.currentTarget.setPointerCapture(e.pointerId)
      }
    }
  }

  function handlePointerCancel() {
    setState(s => ({ ...s, isDragging: false, drag: undefined }))
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (!leavesPressToView(e)) {
      const { x, y } = eventPoint(e)
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
  }

  // Only a live drag writes state here. The hover position comes from the
  // chrome's `mouseTracker` (see `useMouseTracking`), so a plain move does not
  // re-render the component that renders `DisplayChrome`.
  function handleMouseMove(e: React.MouseEvent) {
    // The gate keeps a plain hover free of `setState` and
    // `getBoundingClientRect`. The updater re-tests its own state and returns
    // `s` unchanged without a drag, which React bails out of.
    if (state.isDragging) {
      const { x, y } = pointInData(e, dataLeft)
      setState(s =>
        s.isDragging && s.drag
          ? { ...s, drag: { ...s.drag, endX: x, endY: y } }
          : s,
      )
    }
  }

  function handleMouseUp(e: React.MouseEvent) {
    // Decide outside the setState updater so it stays pure (React strict mode
    // double-invokes updaters).
    const { drag, isDragging } = state
    const draggedFar = isDragging && drag !== undefined && movedFarEnough(drag)
    if (draggedFar) {
      const { x, y } = pointInData(e, dataLeft)
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
      const { x, y } = pointInData(e, dataLeft)
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
      if (
        ref.current &&
        e.target instanceof Node &&
        !ref.current.contains(e.target)
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
    handlePointerCancel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    clearSelectionBox,
  }
}
