import { useEffect } from 'react'

type Coord = [number, number] | undefined

export function useMouseUpHandler(
  mousedown: Coord,
  mouseup: Coord,
  xdistance: number,
  ydistance: number,
  validSelect: boolean,
  setMouseUpClient: (coord: Coord) => void,
  setMouseDownClient: (coord: Coord) => void,
) {
  useEffect(() => {
    function globalMouseUp(event: MouseEvent) {
      if (Math.abs(xdistance) > 3 && Math.abs(ydistance) > 3 && validSelect) {
        setMouseUpClient([event.clientX, event.clientY])
      } else {
        setMouseDownClient(undefined)
      }
    }
    if (mousedown && !mouseup) {
      window.addEventListener('mouseup', globalMouseUp, true)
      return () => {
        window.removeEventListener('mouseup', globalMouseUp, true)
      }
    }
    return () => {}
  }, [
    validSelect,
    mousedown,
    mouseup,
    xdistance,
    ydistance,
    setMouseUpClient,
    setMouseDownClient,
  ])
}
