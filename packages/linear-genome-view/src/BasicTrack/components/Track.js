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

function Track({ children, onHorizontalScroll, trackId }) {
  const [mouseDragging, setMouseDragging] = useState(false)
  const prevX = useRef()
  const classes = useStyles()
  const mainNode = useRef()

  useEffect(() => {
    let cleanup = () => {}

    function mouseMove(event) {
      event.preventDefault()
      const distance = event.clientX - prevX.current
      if (distance) {
        const actualDistance = onHorizontalScroll(-distance)
        prevX.current -= actualDistance
      }
    }

    function mouseUp() {
      prevX.current = undefined
      setMouseDragging(false)
    }

    if (mouseDragging) {
      window.addEventListener('mousemove', mouseMove, true)
      window.addEventListener('mouseup', mouseUp, true)
      cleanup = () => {
        window.removeEventListener('mousemove', mouseMove, true)
        window.removeEventListener('mouseup', mouseUp, true)
      }
    }
    return cleanup
  }, [mouseDragging, onHorizontalScroll])

  function mouseDown(event) {
    event.preventDefault()
    prevX.current = event.clientX
    setMouseDragging(true)
  }

  function mouseLeave(event) {
    event.preventDefault()
  }

  return (
    <div
      data-testid={`track-${trackId}`}
      className={classes.track}
      onMouseDown={mouseDown}
      onMouseLeave={mouseLeave}
      ref={mainNode}
      role="presentation"
    >
      {children}
    </div>
  )
}

Track.propTypes = {
  trackId: PropTypes.string.isRequired,
  children: PropTypes.node,
  onHorizontalScroll: PropTypes.func.isRequired,
}

Track.defaultProps = { children: null }

export default observer(Track)
