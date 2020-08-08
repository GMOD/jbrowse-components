import { makeStyles } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import React, { useRef, useState } from 'react'
import {
  LinearGenomeViewModel,
  RESIZE_HANDLE_HEIGHT,
  SCALE_BAR_HEIGHT,
} from '..'
import RubberBand from './RubberBand'
import ScaleBar from './ScaleBar'
import VerticalGuides from './VerticalGuides'
import CenterLine from './CenterLine'

const useStyles = makeStyles(theme => ({
  tracksContainer: {
    position: 'relative',
    touchAction: 'none',
    borderRadius: theme.shape.borderRadius,
    overflow: 'hidden',
  },
  spacer: {
    position: 'relative',
    height: RESIZE_HANDLE_HEIGHT,
  },
}))

type LGV = LinearGenomeViewModel

function TracksContainer(props: { children: React.ReactNode; model: LGV }) {
  const { children, model } = props
  const classes = useStyles()
  const delta = useRef(0)
  const scheduled = useRef(false)
  const prevX = useRef(0)
  const [pointerDragging, setPointerDragging] = useState(false)

  function extractPositionDelta(event: React.PointerEvent) {
    const left = event.clientX
    const deltaX = left - prevX.current
    prevX.current = left
    return deltaX
  }

  function onWheel(event: React.WheelEvent) {
    const { deltaX, deltaMode } = event
    delta.current += deltaX
    if (!scheduled.current) {
      // use rAF to make it so multiple event handlers aren't fired per-frame
      // see https://calendar.perfplanet.com/2013/the-runtime-performance-checklist/
      scheduled.current = true
      window.requestAnimationFrame(() => {
        model.horizontalScroll(delta.current * (1 + 50 * deltaMode))
        delta.current = 0
        scheduled.current = false
      })
    }
  }

  function pointerDown(event: React.PointerEvent) {
    const target = event.target as HTMLElement
    if (target.draggable || target.dataset.resizer) {
      return
    }
    event.preventDefault()
    setPointerDragging(true)
    extractPositionDelta(event)
    target.setPointerCapture(event.pointerId)
  }

  function pointerMove(event: React.PointerEvent) {
    if (!pointerDragging) {
      return
    }
    delta.current += extractPositionDelta(event)
    if (!scheduled.current) {
      // use rAF to make it so multiple event handlers aren't fired per-frame
      // see https://calendar.perfplanet.com/2013/the-runtime-performance-checklist/
      scheduled.current = true
      window.requestAnimationFrame(() => {
        model.horizontalScroll(-delta.current)
        delta.current = 0
        scheduled.current = false
      })
    }
  }

  function pointerUp(event: React.PointerEvent) {
    const target = event.target as HTMLElement
    event.preventDefault()
    target.releasePointerCapture(event.pointerId)
    setPointerDragging(false)
  }

  return (
    <div
      role="presentation"
      className={classes.tracksContainer}
      onWheel={onWheel}
      onPointerDown={pointerDown}
      onPointerUp={pointerUp}
      onPointerMove={pointerMove}
    >
      <VerticalGuides model={model} />
      {model.showCenterLine ? <CenterLine model={model} /> : null}

      <RubberBand
        model={model}
        ControlComponent={
          <ScaleBar
            model={model}
            style={{ height: SCALE_BAR_HEIGHT, boxSizing: 'border-box' }}
          />
        }
      />
      <div className={classes.spacer} />
      {children}
    </div>
  )
}

export default observer(TracksContainer)
