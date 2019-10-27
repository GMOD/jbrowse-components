/* eslint-disable react/prop-types */
import { makeStyles } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import PropTypes from 'prop-types'
import React, { useEffect, useRef, useState } from 'react'

const useStyles = makeStyles({
  track: {
    position: 'relative',
    whiteSpace: 'nowrap',
    textAlign: 'left',
    width: '100%',
    background: '#555',
    minHeight: '100%',
  },
})

/**
 * mostly does UI gestures: drag scrolling, etc
 */

const Track: React.FC<{
  onHorizontalScroll: Function
  trackId: string
}> = ({ children, onHorizontalScroll, trackId }) => {
  const [mouseDragging, setMouseDragging] = useState(false)
  const [prevX, setPrevX] = useState()
  const classes = useStyles()

  useEffect(() => {
    let cleanup = () => {}

    function globalMouseMove(event: MouseEvent) {
      event.preventDefault()
      const distance = event.clientX - prevX
      if (distance) {
        const actualDistance = onHorizontalScroll(-distance)
        setPrevX(prevX - actualDistance)
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
  }, [mouseDragging, onHorizontalScroll, prevX])

  function mouseDown(event: React.MouseEvent) {
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
      data-testid={`track-${trackId}`}
      className={classes.track}
      onMouseDown={mouseDown}
      onMouseUp={mouseUp}
      onMouseLeave={mouseLeave}
      role="presentation"
    >
      {children}
    </div>
  )
}

export default observer(Track)
