import { useCallback, useEffect, useRef } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { transaction } from 'mobx'
import { observer } from 'mobx-react'

import type { LinearSyntenyViewModel } from '../../LinearSyntenyView/model'
import type { LinearSyntenyDisplayModel } from '../model'

type Timer = ReturnType<typeof setTimeout>

const MainSyntenyCanvas = observer(function ({
  model,
  width,
  height,
  className,
  onMouseMove,
  onMouseLeave,
  onMouseDown,
  onMouseUp,
  onContextMenu,
}: {
  model: LinearSyntenyDisplayModel
  width: number
  height: number
  className: string
  onMouseMove: (event: React.MouseEvent) => void
  onMouseLeave: () => void
  onMouseDown: (event: React.MouseEvent) => void
  onMouseUp: (event: React.MouseEvent) => void
  onContextMenu: (event: React.MouseEvent) => void
}) {
  const view = getContainingView(model) as LinearSyntenyViewModel
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const xOffset = useRef(0)
  const delta = useRef(0)
  const scheduled = useRef(false)
  const timeout = useRef<Timer>(null)

  const setCanvasRef = useCallback(
    (ref: HTMLCanvasElement | null) => {
      model.setMainCanvasRef(ref)
      canvasRef.current = ref
    },
    [model],
  )

  // Wheel handler for zoom/scroll
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    function onWheel(event: WheelEvent) {
      event.preventDefault()
      if (event.ctrlKey) {
        delta.current += event.deltaY / 500
        for (const v of view.views) {
          v.setScaleFactor(
            delta.current < 0 ? 1 - delta.current : 1 / (1 + delta.current),
          )
        }
        if (timeout.current) {
          clearTimeout(timeout.current)
        }
        timeout.current = setTimeout(() => {
          for (const v of view.views) {
            v.setScaleFactor(1)
            v.zoomTo(
              delta.current > 0
                ? v.bpPerPx * (1 + delta.current)
                : v.bpPerPx / (1 - delta.current),
              event.clientX - (canvas!.getBoundingClientRect().left || 0),
            )
          }
          delta.current = 0
        }, 300)
      } else {
        if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) {
          xOffset.current += event.deltaX / 2
        }
        if (!scheduled.current) {
          scheduled.current = true
          window.requestAnimationFrame(() => {
            transaction(() => {
              for (const v of view.views) {
                v.horizontalScroll(xOffset.current)
              }
              xOffset.current = 0
              scheduled.current = false
            })
          })
        }
      }
    }

    canvas.addEventListener('wheel', onWheel)
    return () => {
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [view])

  return (
    <canvas
      ref={setCanvasRef}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onContextMenu={onContextMenu}
      data-testid="synteny_canvas"
      className={className}
      width={width}
      height={height}
    />
  )
})

export default MainSyntenyCanvas
