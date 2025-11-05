import { useEffect } from 'react'

type Coord = [number, number] | undefined

interface View {
  scroll: (distance: number) => void
}

export function useMouseMoveHandler(
  mousecurrClient: Coord,
  mousedownClient: Coord,
  mouseupClient: Coord,
  validPan: boolean,
  hview: View,
  vview: View,
  setMouseCurrClient: (coord: Coord) => void,
) {
  useEffect(() => {
    function globalMouseMove(event: MouseEvent) {
      setMouseCurrClient([event.clientX, event.clientY])

      if (mousecurrClient && mousedownClient && validPan && !mouseupClient) {
        hview.scroll(-event.clientX + mousecurrClient[0])
        vview.scroll(event.clientY - mousecurrClient[1])
      }
    }

    window.addEventListener('mousemove', globalMouseMove)
    return () => {
      window.removeEventListener('mousemove', globalMouseMove)
    }
  }, [
    validPan,
    mousecurrClient,
    mousedownClient,
    mouseupClient,
    hview,
    vview,
    setMouseCurrClient,
  ])
}
