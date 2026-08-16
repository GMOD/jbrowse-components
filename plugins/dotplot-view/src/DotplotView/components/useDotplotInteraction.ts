import { useEffect, useRef, useState } from 'react'

import { createFrameCoalescer } from '@jbrowse/core/util/frameCoalescer'

import { DRAG_THRESHOLD_PX } from '../types.ts'

import type { DotplotViewModel } from '../model.ts'
import type { Coord } from '../types.ts'
import type React from 'react'

// A pointer sample in both frames the UI needs: component-relative (bp math,
// drag rect) and viewport-relative (tooltip/menu anchoring). ctrlKey rides
// along so the modifier state is read off the pointer stream rather than a
// separate pair of global keyboard listeners.
export interface PointerSample {
  x: number
  y: number
  clientX: number
  clientY: number
  ctrlKey: boolean
}

function sample(event: React.PointerEvent<HTMLElement>): PointerSample {
  const { left, top } = event.currentTarget.getBoundingClientRect()
  const { clientX, clientY } = event
  return {
    x: clientX - left,
    y: clientY - top,
    clientX,
    clientY,
    ctrlKey: event.ctrlKey || event.metaKey,
  }
}

// Displacement from the drag anchor. Under the aspect-ratio lock it is squared
// off in pixel space, so the box-zoom the drag produces can't fight the lock.
function dragVector(from: PointerSample, to: PointerSample, square: boolean) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const side = Math.min(Math.abs(dx), Math.abs(dy))
  return square
    ? { dx: Math.sign(dx) * side, dy: Math.sign(dy) * side }
    : { dx, dy }
}

export interface DotplotInteraction {
  // spread onto the element that owns the plot area
  containerProps: {
    ref: (el: HTMLDivElement | null) => void
    style: React.CSSProperties
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void
    onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void
    onPointerCancel: () => void
    onPointerLeave: () => void
  }
  // drag anchor, undefined outside a drag
  anchor: PointerSample | undefined
  // Where the pointer is, or undefined once it has left the plot — which is
  // also what says "nothing is hovered", so there is no second `hovering` flag
  // to re-arm. There was one, set only by pointerenter, and anything that
  // lowered it without the pointer leaving (the selection menu did) left the
  // coordinate tooltip dead until the pointer exited the plot and came back.
  //
  // During a drag it is the opposite corner of the rect, squared off under the
  // aspect lock and pinned once the drag is committed.
  pointer: PointerSample | undefined
  // signed drag extent in component px; sign drives tooltip placement
  dx: number
  dy: number
  // drag would select rather than pan, under the current cursor mode + modifier
  validSelect: boolean
  // the drag is a selection worth acting on, not a click
  selecting: boolean
  // pointer released on a selection — the context menu is open
  committed: boolean
  clear: () => void
}

export function useDotplotInteraction(
  model: DotplotViewModel,
): DotplotInteraction {
  const { cursorMode, lockAspectRatio } = model

  // eslint-disable-next-line @eslint-react/use-state -- callback ref (ref={el}), not a setState setter
  const [refEl, setRefEl] = useState<HTMLDivElement | null>(null)
  const [down, setDown] = useState<PointerSample>()
  const [curr, setCurr] = useState<PointerSample>()
  const [up, setUp] = useState<PointerSample>()

  // The previous pointer sample, for the pan delta. Kept in a ref as well as in
  // `curr` because a pan does not need to re-render: the scroll it produces is a
  // MobX write the axes and canvas already observe, while `setCurr` re-renders
  // this whole subtree — both axes, every block and tick — once per pointermove.
  // Nothing reads `curr` during a pan either: the tooltip and the drag rect are
  // behind `validSelect`, which a pan has false by definition.
  const lastRef = useRef<PointerSample>(undefined)

  // ctrl inverts the cursor mode: it turns pan into select and select into pan.
  // Once a drag starts the modifier is whatever it was at pointerdown, so
  // releasing ctrl mid-drag can't switch a selection into a pan.
  const ctrlLive = curr?.ctrlKey ?? false
  const ctrlActive = down ? down.ctrlKey : ctrlLive
  const validSelect = ctrlActive
    ? cursorMode === 'move'
    : cursorMode === 'crosshair'

  const target = up ?? curr
  const { dx, dy } =
    down && target
      ? dragVector(down, target, lockAspectRatio)
      : { dx: 0, dy: 0 }
  const pointer =
    down && target
      ? {
          ...target,
          x: down.x + dx,
          y: down.y + dy,
          clientX: down.clientX + dx,
          clientY: down.clientY + dy,
        }
      : curr
  const selecting =
    validSelect &&
    !!down &&
    Math.abs(dx) > DRAG_THRESHOLD_PX &&
    Math.abs(dy) > DRAG_THRESHOLD_PX

  const clear = () => {
    setDown(undefined)
    setUp(undefined)
  }

  // The one effect: React attaches wheel passively, so preventDefault needs a
  // hand-registered non-passive listener. The per-frame accumulator lives in
  // this closure — many wheel events land between paints and must collapse into
  // one zoom/pan step, and nothing outside the listener reads them.
  //
  // The dotplot runs its own gesture rule rather than `createWheelZoomController`
  // (LGV, breakpoint, synteny): those zoom about a cursor x on a stack of
  // 1D views and pan one axis, where this zooms about a 2D anchor on a plot with
  // two independently scaled axes and pans both. What the two do share is the
  // frame coalescing, which is `createFrameCoalescer` — including the cancel,
  // without which a view closed mid-fling flushed into a destroyed MST node.
  useEffect(() => {
    if (!refEl) {
      return
    }
    const el = refEl
    const frame = createFrameCoalescer()
    let dx = 0
    let dy = 0
    let anchor: Coord = [0, 0]
    function onWheel(event: WheelEvent) {
      // Every gesture below is handled (zoom or pan), so this never swallows a
      // scroll the view then ignores.
      event.preventDefault()
      dx += event.deltaX
      dy -= event.deltaY
      if (!frame.pending) {
        // Anchor on the wheel event's own position, so zoom doesn't depend on a
        // pointermove having landed first. Measured once per frame, behind the
        // pending check: `getBoundingClientRect` forces a synchronous reflow,
        // and a trackpad burst reaching it per event is what trips
        // "[Violation] 'wheel' handler took Nms".
        const { left, top } = el.getBoundingClientRect()
        anchor = [event.clientX - left, event.clientY - top]
      }
      frame.schedule(() => {
        if (Math.abs(dy) > Math.abs(dx) * 2) {
          model.zoomAt(dy < 0 ? 1.07 : 0.935, anchor)
        } else {
          // dy is already sign-flipped, matching vview's bottom-up axis: a
          // downward wheel moves the viewport toward the bottom of the plot,
          // the opposite of a downward drag.
          model.scrollXY(dx, dy)
        }
        // No hover clear here: a wheel moves the plot under a stationary
        // cursor, and `setupClearHoverOnPlotMove` answers that for every way
        // the plot can move rather than for this one.
        dx = 0
        dy = 0
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      frame.cancel()
    }
  }, [refEl, model])

  return {
    containerProps: {
      ref: setRefEl,
      style: { cursor: ctrlLive ? 'pointer' : cursorMode },
      onPointerDown: event => {
        if (event.button === 0) {
          // Pointer capture keeps move/up on this element once the drag leaves
          // its bounds, so no window-level listeners are needed.
          event.currentTarget.setPointerCapture(event.pointerId)
          const s = sample(event)
          setDown(s)
          setCurr(s)
          lastRef.current = s
          setUp(undefined)
          // A gesture is starting, so the hover is over. A pan is covered by
          // `setupClearHoverOnPlotMove` anyway; a selection drag moves nothing
          // and is not, and it wants this anchor for its own pair of coord
          // tooltips. Cleared once here rather than per move — the move handler
          // below simply doesn't pick while `down` is set.
          model.setHoveredFeature(undefined)
        }
      },
      onPointerMove: event => {
        const s = sample(event)
        const last = lastRef.current
        lastRef.current = s
        const panning = !!down && !up && !validSelect
        if (panning) {
          if (last) {
            // vview lays out bottom-up, so its delta is the screen one
            // unnegated while hview's is negated — both in axis-scroll
            // direction, which is what scrollXY takes.
            model.scrollXY(last.clientX - s.clientX, s.clientY - last.clientY)
          }
        } else {
          setCurr(s)
          if (!down) {
            model.setHoveredFeature(model.pickFeatureAt(s.x, s.y))
          }
        }
      },
      onPointerUp: event => {
        // The same button that started the drag ends it. Pressing a second
        // button mid-drag and releasing it delivers a pointerup like any other,
        // which without this ended the gesture: a right-click during a
        // selection committed the box and opened the menu under the browser's
        // own context menu, and during a pan it dropped the anchor mid-stroke.
        if (event.button !== 0) {
          return
        }
        // Commit a real selection (opens the context menu); a click cancels.
        if (selecting) {
          setUp(sample(event))
        } else {
          clear()
        }
      },
      // A cancelled pointer never delivers its `up`, so without this the drag
      // anchor outlives the gesture: the browser takes the pointer over (a touch
      // that turns into a page scroll, a system gesture), releases capture, and
      // every later pointermove over the plot still reads as `down && !up` and
      // pans it. Dropping the anchor is the same thing a click does.
      onPointerCancel: () => {
        lastRef.current = undefined
        clear()
      },
      // Both halves of "the pointer is gone": the alignment it was over stops
      // being hovered, and the sample the coordinate tooltip reads stops
      // existing. Dropping only the first left a tooltip printing the position
      // the pointer had when it crossed the edge.
      onPointerLeave: () => {
        setCurr(undefined)
        model.setHoveredFeature(undefined)
      },
    },
    anchor: down,
    pointer,
    dx,
    dy,
    validSelect,
    selecting,
    committed: !!up,
    clear,
  }
}
