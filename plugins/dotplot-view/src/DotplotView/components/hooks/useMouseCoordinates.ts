import { useLayoutEffect, useRef, useState } from 'react'

type Coord = [number, number] | undefined

interface Rect {
  left: number
  top: number
  width: number
  height: number
}

const blank: Rect = { left: 0, top: 0, width: 0, height: 0 }

// produces offsetX/offsetY coordinates from a clientX and an element's
// getBoundingClientRect
function getOffset(coord: Coord, rect: Rect) {
  return coord && ([coord[0] - rect.left, coord[1] - rect.top] as Coord)
}

export function useMouseCoordinates() {
  const [mousecurrClient, setMouseCurrClient] = useState<Coord>()
  const [mousedownClient, setMouseDownClient] = useState<Coord>()
  const [mouseupClient, setMouseUpClient] = useState<Coord>()
  const [mouseOvered, setMouseOvered] = useState(false)
  const [rect, setRect] = useState<Rect>(blank)
  const ref = useRef<HTMLDivElement>(null)
  const root = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (ref.current) {
      setRect(ref.current.getBoundingClientRect())
    }
  }, [mousecurrClient, mousedownClient, mouseupClient])

  const svg = rect
  const rootRect = rect
  const mousedown = getOffset(mousedownClient, rect)
  const mousecurr = getOffset(mousecurrClient, rect)
  const mouseup = getOffset(mouseupClient, rect)
  const mouserect = mouseup || mousecurr
  const mouserectClient = mouseupClient || mousecurrClient
  const xdistance = mousedown && mouserect ? mouserect[0] - mousedown[0] : 0
  const ydistance = mousedown && mouserect ? mouserect[1] - mousedown[1] : 0

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
    ref,
    root,
    // Derived values
    svg,
    rootRect,
    mousedown,
    mousecurr,
    mouseup,
    mouserect,
    mouserectClient,
    xdistance,
    ydistance,
  }
}
