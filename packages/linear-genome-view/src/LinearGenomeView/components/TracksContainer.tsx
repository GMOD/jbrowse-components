import { makeStyles } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import React, { useEffect, useRef, useState } from 'react'
import {
  LinearGenomeViewStateModel,
  RESIZE_HANDLE_HEIGHT,
  SCALE_BAR_HEIGHT,
} from '..'
import RubberBand from './RubberBand'
import ScaleBar from './ScaleBar'
import VerticalGuides from './VerticalGuides'

const useStyles = makeStyles(theme => ({
  tracksContainer: {
    position: 'relative',
    borderRadius: theme.shape.borderRadius,
    overflow: 'hidden',
  },
  spacer: {
    position: 'relative',
    height: RESIZE_HANDLE_HEIGHT,
  },
}))

type LGV = Instance<LinearGenomeViewStateModel>

function TracksContainer({
  children,
  model,
}: {
  children: React.ReactNode
  model: LGV
}) {
  const classes = useStyles()
  // refs are to store these variables to avoid repeated rerenders associated with useState/setState
  const delta = useRef(0)
  const scheduled = useRef(false)

  const [mouseDragging, setMouseDragging] = useState(false)
  const prevX = useRef<number | null>(null)
  useState()

  useEffect(() => {
    let cleanup = () => {}

    function globalMouseMove(event: MouseEvent) {
      event.preventDefault()
      const distance =
        prevX.current !== null ? event.clientX - prevX.current : event.clientX
      if (distance) {
        // use rAF to make it so multiple event handlers aren't fired per-frame
        // see https://calendar.perfplanet.com/2013/the-runtime-performance-checklist/
        if (!scheduled.current) {
          scheduled.current = true
          window.requestAnimationFrame(() => {
            model.horizontalScroll(-distance)
            scheduled.current = false
            prevX.current = event.clientX
          })
        }
      }
    }

    function globalMouseUp() {
      prevX.current = null
      setMouseDragging(false)
    }

    if (mouseDragging) {
      window.addEventListener('mousemove', globalMouseMove, true)
      window.addEventListener('mouseup', globalMouseUp, true)
      cleanup = () => {
        window.removeEventListener('mousemove', globalMouseMove, true)
        window.removeEventListener('mouseup', globalMouseUp, true)
      }
    }
    return cleanup
  }, [model, mouseDragging, prevX])

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

  function mouseDown(event: React.MouseEvent) {
    if ((event.target as HTMLElement).draggable) return
    if (event.button === 0) {
      event.preventDefault()
      prevX.current = event.clientX
      setMouseDragging(true)
    }
  }

  // this local mouseup is used in addition to the global because sometimes
  // the global add/remove are not called in time, resulting in issue #533
  function mouseUp(event: React.MouseEvent) {
    event.preventDefault()
    setMouseDragging(false)
  }

  function mouseLeave(event: React.MouseEvent) {
    event.preventDefault()
  }

  return (
    <div
      className={classes.tracksContainer}
      onWheel={onWheel}
      onMouseDown={mouseDown}
      onMouseUp={mouseUp}
      onMouseLeave={mouseLeave}
    >
      <VerticalGuides model={model}>
        <RubberBand
          model={model}
          ControlComponent={
            // Subtract two from height for ScaleBar borders
            <ScaleBar
              model={model}
              style={{ height: SCALE_BAR_HEIGHT, boxSizing: 'border-box' }}
            />
          }
        >
          <div className={classes.spacer} />
          {children}
        </RubberBand>
      </VerticalGuides>
    </div>
  )
}

export default observer(TracksContainer)
