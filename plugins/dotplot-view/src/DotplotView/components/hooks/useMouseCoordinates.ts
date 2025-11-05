import { useRef, useState } from 'react'

type Coord = [number, number] | undefined

interface Rect {
  left: number
  top: number
}

const blank = { left: 0, top: 0, width: 0, height: 0 }

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
  const ref = useRef<HTMLDivElement>(null)
  const root = useRef<HTMLDivElement>(null)

  const svg = ref.current?.getBoundingClientRect() || blank
  const rootRect = ref.current?.getBoundingClientRect() || blank
  const mousedown = getOffset(mousedownClient, svg)
  const mousecurr = getOffset(mousecurrClient, svg)
  const mouseup = getOffset(mouseupClient, svg)
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
