import { useEffect, useState } from 'react'

import { transaction } from 'mobx'

import type { DotplotViewModel } from '../model.ts'
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

// Below this the drag is a click, not a selection.
const DRAG_THRESHOLD_PX = 3

export interface DotplotInteraction {
  // spread onto the element that owns the plot area
  containerProps: {
    ref: (el: HTMLDivElement | null) => void
    style: React.CSSProperties
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void
    onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void
    onPointerEnter: () => void
    onPointerLeave: () => void
  }
  // drag anchor, undefined outside a drag
  anchor: PointerSample | undefined
  // live pointer; during a drag it is the opposite corner (squared off under
  // the aspect lock, pinned once the drag is committed)
  pointer: PointerSample | undefined
  // signed drag extent in component px; sign drives tooltip placement
  dx: number
  dy: number
  hovering: boolean
  // drag would select rather than pan, under the current cursor mode + modifier
  validSelect: boolean
  // the drag is a selection worth acting on, not a click
  selecting: boolean
  // pointer released on a selection — the context menu is open
  committed: boolean
  setHovering: (arg: boolean) => void
  clear: () => void
}

export function useDotplotInteraction(
  model: DotplotViewModel,
): DotplotInteraction {
  const { hview, vview, cursorMode, lockAspectRatio } = model

  // eslint-disable-next-line @eslint-react/use-state -- callback ref (ref={el}), not a setState setter
  const [refEl, setRefEl] = useState<HTMLDivElement | null>(null)
  const [down, setDown] = useState<PointerSample>()
  const [curr, setCurr] = useState<PointerSample>()
  const [up, setUp] = useState<PointerSample>()
  const [hovering, setHovering] = useState(false)

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
  useEffect(() => {
    if (!refEl) {
      return
    }
    const el = refEl
    let dx = 0
    let dy = 0
    let scheduled = false
    function onWheel(event: WheelEvent) {
      // Every gesture below is handled (zoom or pan), so this never swallows a
      // scroll the view then ignores.
      event.preventDefault()
      dx += event.deltaX
      dy -= event.deltaY
      if (!scheduled) {
        scheduled = true
        // Anchor on the wheel event's own position, so zoom doesn't depend on
        // a pointermove having landed first.
        const { left, top, height } = el.getBoundingClientRect()
        const ax = event.clientX - left
        const ay = event.clientY - top
        window.requestAnimationFrame(() => {
          transaction(() => {
            if (Math.abs(dy) > Math.abs(dx) * 2) {
              const val = dy < 0 ? 1.07 : 0.935
              hview.zoomTo(hview.bpPerPx * val, ax)
              vview.zoomTo(vview.bpPerPx * val, height - ay)
            } else {
              // dy is already sign-flipped, matching vview's bottom-up axis: a
              // downward wheel moves the viewport toward the bottom of the
              // plot, the opposite of a downward drag.
              hview.scroll(dx)
              vview.scroll(dy)
            }
          })
          scheduled = false
          dx = 0
          dy = 0
        })
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
    }
  }, [refEl, hview, vview])

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
          setUp(undefined)
        }
      },
      onPointerMove: event => {
        const s = sample(event)
        setCurr(s)
        const panning = !!down && !up && !validSelect
        if (panning && curr) {
          hview.scroll(curr.clientX - s.clientX)
          vview.scroll(s.clientY - curr.clientY)
        }
      },
      onPointerUp: event => {
        // Commit a real selection (opens the context menu); a click cancels.
        if (selecting) {
          setUp(sample(event))
        } else {
          clear()
        }
      },
      onPointerEnter: () => {
        setHovering(true)
      },
      onPointerLeave: () => {
        setHovering(false)
      },
    },
    anchor: down,
    pointer,
    dx,
    dy,
    hovering,
    validSelect,
    selecting,
    committed: !!up,
    setHovering,
    clear,
  }
}
