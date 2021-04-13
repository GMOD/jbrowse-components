import { makeStyles } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import React, { useEffect, useRef, useState } from 'react'
import normalizeWheel from 'normalize-wheel'

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
type Timer = ReturnType<typeof setTimeout>

function TracksContainer({
  children,
  model,
}: {
  children: React.ReactNode
  model: LGV
}) {
  const classes = useStyles()
  // refs are to store these variables to avoid repeated rerenders associated
  // with useState/setState
  const delta = useRef(0)
  const scheduled = useRef(false)
  const timeout = useRef<Timer>()
  const ref = useRef<HTMLDivElement>(null)
  const prevX = useRef<number>(0)

  const [mouseDragging, setMouseDragging] = useState(false)

  useEffect(() => {
    let cleanup = () => {}

    function globalMouseMove(event: MouseEvent) {
      event.preventDefault()
      const currX = event.clientX
      const distance = currX - prevX.current
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
      prevX.current = 0
      if (mouseDragging) {
        setMouseDragging(false)
      }
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

  function mouseDown(event: React.MouseEvent) {
    // check if clicking a draggable element or a resize handle
    const target = event.target as HTMLElement
    if (target.draggable || target.dataset.resizer) {
      return
    }

    // otherwise do click and drag scroll
    if (event.button === 0) {
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

  useEffect(() => {
    const curr = ref.current
    // if ctrl is held down, zoom in with y-scroll
    // else scroll horizontally with x-scroll
    function onWheel(origEvent: WheelEvent) {
      const event = normalizeWheel(origEvent)
      if (origEvent.ctrlKey === true) {
        origEvent.preventDefault()
        delta.current += event.pixelY / 500
        model.setScaleFactor(
          delta.current < 0 ? 1 - delta.current : 1 / (1 + delta.current),
        )
        if (timeout.current) {
          clearTimeout(timeout.current)
        }
        timeout.current = setTimeout(() => {
          model.setScaleFactor(1)
          model.zoomTo(
            delta.current > 0
              ? model.bpPerPx * (1 + delta.current)
              : model.bpPerPx / (1 - delta.current),
          )
          delta.current = 0
        }, 300)
      } else {
        // this is needed to stop the event from triggering "back button
        // action" on MacOSX etc.  but is a heuristic to avoid preventing the
        // inner-track scroll behavior
        if (Math.abs(event.pixelX) > Math.abs(2 * event.pixelY)) {
          origEvent.preventDefault()
        }
        delta.current += event.pixelX
        if (!scheduled.current) {
          // use rAF to make it so multiple event handlers aren't fired per-frame
          // see https://calendar.perfplanet.com/2013/the-runtime-performance-checklist/
          scheduled.current = true
          window.requestAnimationFrame(() => {
            model.horizontalScroll(delta.current)
            delta.current = 0
            scheduled.current = false
          })
        }
      }
    }
    if (curr) {
      curr.addEventListener('wheel', onWheel)
      return () => {
        curr.removeEventListener('wheel', onWheel)
      }
    }
    return () => {}
  }, [model])

  return (
    <div
      ref={ref}
      role="presentation"
      className={classes.tracksContainer}
      onMouseDown={mouseDown}
      onMouseUp={mouseUp}
      onMouseLeave={mouseLeave}
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
