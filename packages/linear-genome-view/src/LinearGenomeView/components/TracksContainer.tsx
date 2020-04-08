import { makeStyles } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import React, { useEffect, useState } from 'react'
import {
  LinearGenomeViewStateModel,
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
  const [scheduled, setScheduled] = useState(false)
  const [delta, setDelta] = useState(0)
  const [mouseDragging, setMouseDragging] = useState(false)
  const [prevX, setPrevX] = useState()

  useEffect(() => {
    let cleanup = () => {}

    function globalMouseMove(event: MouseEvent) {
      event.preventDefault()
      const distance = event.clientX - prevX
      if (distance) {
        if (!scheduled) {
          // use rAF to make it so multiple event handlers aren't fired per-frame
          // see https://calendar.perfplanet.com/2013/the-runtime-performance-checklist/
          window.requestAnimationFrame(() => {
            model.horizontalScroll(-distance)
            setScheduled(false)
            setPrevX(event.clientX)
          })
          setScheduled(true)
        }
      }
    }

    function globalMouseUp() {
      setPrevX(undefined)
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
  }, [delta, model, mouseDragging, prevX, scheduled])

  function onWheel(event: React.WheelEvent) {
    const { deltaX, deltaMode } = event
    if (scheduled) {
      setDelta(delta + deltaX)
    } else {
      // use rAF to make it so multiple event handlers aren't fired per-frame
      // see https://calendar.perfplanet.com/2013/the-runtime-performance-checklist/
      window.requestAnimationFrame(() => {
        model.horizontalScroll((delta + deltaX) * (1 + 50 * deltaMode))
        setScheduled(false)
      })
      setScheduled(true)
      setDelta(0)
    }
  }

  function mouseDown(event: React.MouseEvent) {
    if ((event.target as HTMLElement).draggable) return
    if (event.button === 0) {
      event.preventDefault()
      setPrevX(event.clientX)
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
        {model.showCenterLine && <CenterLine model={model}></CenterLine>}
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
