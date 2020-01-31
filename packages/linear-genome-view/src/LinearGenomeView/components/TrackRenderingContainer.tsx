/* eslint-disable react/require-default-props */
import { makeStyles } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import PropTypes from 'prop-types'
import React, { ReactNode, useEffect, useState } from 'react'

const useStyles = makeStyles({
  trackRenderingContainer: {
    overflowY: 'auto',
    overflowX: 'hidden',
    background: '#555',
    whiteSpace: 'nowrap',
  },
})

/**
 * mostly does UI gestures: drag scrolling, etc
 */
const TrackRenderingContainer: React.FC<{
  onHorizontalScroll: Function
  setScrollTop: Function
  children?: ReactNode
  trackId: string
  trackHeight: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [x: string]: any
}> = props => {
  const {
    onHorizontalScroll,
    setScrollTop,
    trackId,
    trackHeight,
    children,
    ...other
  } = props
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
            onHorizontalScroll(-distance)
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
  }, [delta, mouseDragging, onHorizontalScroll, prevX, scheduled])

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
    <>
      <div
        className={classes.trackRenderingContainer}
        onWheel={event => {
          const { deltaX, deltaMode } = event
          if (scheduled) {
            setDelta(delta + deltaX)
          } else {
            // use rAF to make it so multiple event handlers aren't fired per-frame
            // see https://calendar.perfplanet.com/2013/the-runtime-performance-checklist/
            window.requestAnimationFrame(() => {
              onHorizontalScroll((delta + deltaX) * (1 + 50 * deltaMode))
              setScheduled(false)
            })
            setScheduled(true)
            setDelta(0)
          }
        }}
        style={{ height: trackHeight }}
        onScroll={event => {
          const target = event.target as HTMLDivElement
          setScrollTop(target.scrollTop, target.clientHeight)
        }}
        onMouseDown={mouseDown}
        onMouseUp={mouseUp}
        onMouseLeave={mouseLeave}
        role="presentation"
        {...other}
      >
        {children}
      </div>
    </>
  )
}

TrackRenderingContainer.propTypes = {
  trackId: PropTypes.string.isRequired,
  children: PropTypes.node,
  setScrollTop: PropTypes.func.isRequired,
  onHorizontalScroll: PropTypes.func.isRequired,
  trackHeight: PropTypes.number.isRequired,
}

export default observer(TrackRenderingContainer)
