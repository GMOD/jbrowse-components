import { useEffect, useRef, useState } from 'react'

import { transaction } from 'mobx'

import type { DotplotViewModel } from '../model.ts'
import type { Coord } from '../types.ts'

interface Rect {
  left: number
  top: number
  width: number
  height: number
}

const blankRect: Rect = { left: 0, top: 0, width: 0, height: 0 }

function offsetCoord(coord: Coord, rect: Rect): Coord {
  return coord && [coord[0] - rect.left, coord[1] - rect.top]
}

export interface DotplotInteraction {
  // component-relative coordinates
  mousedown: Coord
  mousecurr: Coord
  mouseup: Coord
  mouserect: Coord
  // viewport-relative coordinates (for tooltip placement)
  mousedownClient: Coord
  mouseupClient: Coord
  mouserectClient: Coord
  // drag-rect size in component pixels
  xdistance: number
  ydistance: number
  // gating
  mouseOvered: boolean
  ctrlKeyDown: boolean
  validPan: boolean
  validSelect: boolean
  // setters that children call back into
  setMouseDownClient: (coord: Coord) => void
  setMouseCurrClient: (coord: Coord) => void
  setMouseUpClient: (coord: Coord) => void
  setMouseOvered: (b: boolean) => void
  setCtrlKeyWasUsed: (b: boolean) => void
  // ref for the interaction container
  refCallback: (el: HTMLDivElement | null) => void
  // active drag selection in component pixels, if any
  selection: { width: number; height: number } | undefined
}

export function useDotplotInteraction(
  model: DotplotViewModel,
): DotplotInteraction {
  const { hview, vview, cursorMode, lockAspectRatio } = model

  const [refEl, refCallback] = useState<HTMLDivElement | null>(null)
  const [mousecurrClient, setMouseCurrClient] = useState<Coord>()
  const [mousedownClient, setMouseDownClient] = useState<Coord>()
  const [mouseupClient, setMouseUpClient] = useState<Coord>()
  const [mouseOvered, setMouseOvered] = useState(false)
  const [ctrlKeyWasUsed, setCtrlKeyWasUsed] = useState(false)
  const [ctrlKeyDown, setCtrlKeyDown] = useState(false)

  const rect = refEl?.getBoundingClientRect() ?? blankRect
  const mousedown = offsetCoord(mousedownClient, rect)
  const mousecurr = offsetCoord(mousecurrClient, rect)
  const mouseupRaw = offsetCoord(mouseupClient, rect)
  const mouserectRaw = mouseupRaw ?? mousecurr
  const rawX = mousedown && mouserectRaw ? mouserectRaw[0] - mousedown[0] : 0
  const rawY = mousedown && mouserectRaw ? mouserectRaw[1] - mousedown[1] : 0
  // When the aspect-ratio lock is engaged, constrain the drag rect to a
  // square in pixel space so the resulting box-zoom can't fight the lock.
  const side = Math.min(Math.abs(rawX), Math.abs(rawY))
  const xdistance = lockAspectRatio ? Math.sign(rawX) * side : rawX
  const ydistance = lockAspectRatio ? Math.sign(rawY) * side : rawY
  const mouseup =
    lockAspectRatio && mousedown && mouseupRaw
      ? ([mousedown[0] + xdistance, mousedown[1] + ydistance] as Coord)
      : mouseupRaw
  const mouserect =
    lockAspectRatio && mousedown && mouserectRaw
      ? ([mousedown[0] + xdistance, mousedown[1] + ydistance] as Coord)
      : mouserectRaw
  const mouserectClient = mouseupClient ?? mousecurrClient

  const validPan =
    (cursorMode === 'move' && !ctrlKeyWasUsed) ||
    (cursorMode === 'crosshair' && ctrlKeyWasUsed)
  const validSelect =
    (cursorMode === 'move' && ctrlKeyWasUsed) ||
    (cursorMode === 'crosshair' && !ctrlKeyWasUsed)

  // wheel: accumulate per-frame, then zoom in a single transaction
  const distanceX = useRef(0)
  const distanceY = useRef(0)
  const scheduled = useRef(false)
  useEffect(() => {
    if (!refEl) {
      return
    }
    function onWheel(event: WheelEvent) {
      event.preventDefault()
      distanceX.current += event.deltaX
      distanceY.current -= event.deltaY
      if (!scheduled.current) {
        scheduled.current = true
        window.requestAnimationFrame(() => {
          transaction(() => {
            if (
              Math.abs(distanceY.current) > Math.abs(distanceX.current) * 2 &&
              mousecurr
            ) {
              const val = distanceY.current < 0 ? 1.07 : 0.935
              hview.zoomTo(hview.bpPerPx * val, mousecurr[0])
              vview.zoomTo(vview.bpPerPx * val, rect.height - mousecurr[1])
            }
          })
          scheduled.current = false
          distanceX.current = 0
          distanceY.current = 0
        })
      }
    }
    refEl.addEventListener('wheel', onWheel)
    return () => {
      refEl.removeEventListener('wheel', onWheel)
    }
  }, [refEl, hview, vview, mousecurr, rect.height])

  // mousemove: pan while dragging without mouseup pinned
  useEffect(() => {
    function onMove(event: MouseEvent) {
      setMouseCurrClient([event.clientX, event.clientY])
      if (mousecurrClient && mousedownClient && validPan && !mouseupClient) {
        hview.scroll(-event.clientX + mousecurrClient[0])
        vview.scroll(event.clientY - mousecurrClient[1])
      }
    }
    window.addEventListener('mousemove', onMove)
    return () => {
      window.removeEventListener('mousemove', onMove)
    }
  }, [validPan, mousecurrClient, mousedownClient, mouseupClient, hview, vview])

  // ctrl/meta-key tracking (mode-switch modifier)
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey) {
        setCtrlKeyDown(true)
      }
    }
    function onKeyUp(event: KeyboardEvent) {
      if (!event.metaKey && !event.ctrlKey) {
        setCtrlKeyDown(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  // mouseup: commit selection if drag exceeded threshold, else cancel.
  // Depend on the underlying client state (stable identity) rather than the
  // derived tuples (recreated each render) so the listener isn't churned.
  const hasDrag = !!mousedownClient && !mouseupClient
  useEffect(() => {
    if (!hasDrag) {
      return
    }
    function onUp(event: MouseEvent) {
      if (Math.abs(xdistance) > 3 && Math.abs(ydistance) > 3 && validSelect) {
        setMouseUpClient([event.clientX, event.clientY])
      } else {
        setMouseDownClient(undefined)
      }
    }
    window.addEventListener('mouseup', onUp, true)
    return () => {
      window.removeEventListener('mouseup', onUp, true)
    }
  }, [validSelect, hasDrag, xdistance, ydistance])

  const dragOpen =
    !!mousedown &&
    !!mouserect &&
    validSelect &&
    Math.abs(xdistance) > 3 &&
    Math.abs(ydistance) > 3
  const selection = dragOpen
    ? { width: Math.abs(xdistance), height: Math.abs(ydistance) }
    : undefined

  return {
    mousedown,
    mousecurr,
    mouseup,
    mouserect,
    mousedownClient,
    mouseupClient,
    mouserectClient,
    xdistance,
    ydistance,
    mouseOvered,
    ctrlKeyDown,
    validPan,
    validSelect,
    setMouseDownClient,
    setMouseCurrClient,
    setMouseUpClient,
    setMouseOvered,
    setCtrlKeyWasUsed,
    refCallback,
    selection,
  }
}
