import { useState } from 'react'

import type { Coord } from '../../types.ts'

interface Rect {
  left: number
  top: number
  width: number
  height: number
}

const blank: Rect = { left: 0, top: 0, width: 0, height: 0 }

function getOffset(coord: Coord, rect: Rect) {
  return coord && ([coord[0] - rect.left, coord[1] - rect.top] as Coord)
}

export function useMouseCoordinates(lockAspectRatio = false) {
  const [mousecurrClient, setMouseCurrClient] = useState<Coord>()
  const [mousedownClient, setMouseDownClient] = useState<Coord>()
  const [mouseupClient, setMouseUpClient] = useState<Coord>()
  const [mouseOvered, setMouseOvered] = useState(false)
  const [refEl, refCallback] = useState<HTMLDivElement | null>(null)

  const rect = refEl?.getBoundingClientRect() ?? blank
  const mousedown = getOffset(mousedownClient, rect)
  const mousecurr = getOffset(mousecurrClient, rect)
  const mouseupRaw = getOffset(mouseupClient, rect)
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

  return {
    // State
    mousecurrClient,
    mousedownClient,
    mouseupClient,
    mouseOvered,
    // Setters
    setMouseCurrClient,
    setMouseDownClient,
    setMouseUpClient,
    setMouseOvered,
    // Refs
    refEl,
    refCallback,
    // Derived values
    rect,
    mousedown,
    mousecurr,
    mouseup,
    mouserect,
    mouserectClient,
    xdistance,
    ydistance,
  }
}
