import { useEffect, useRef } from 'react'

import { transaction } from 'mobx'

import type { Coord } from '../../types.ts'

interface View {
  zoomTo: (bpPerPx: number, position: number) => void
  bpPerPx: number
}

export function useWheelHandler(
  ref: React.RefObject<HTMLDivElement | null>,
  hview: View,
  vview: View,
  mousecurr: Coord,
  rootRectHeight: number,
) {
  const distanceY = useRef(0)
  const distanceX = useRef(0)
  const scheduled = useRef(false)

  useEffect(() => {
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
              vview.zoomTo(vview.bpPerPx * val, rootRectHeight - mousecurr[1])
            }
          })
          scheduled.current = false
          distanceX.current = 0
          distanceY.current = 0
        })
      }
    }
    if (ref.current) {
      const curr = ref.current
      curr.addEventListener('wheel', onWheel)
      return () => {
        curr.removeEventListener('wheel', onWheel)
      }
    }
    return () => {}
  }, [hview, vview, mousecurr, rootRectHeight, ref])
}
