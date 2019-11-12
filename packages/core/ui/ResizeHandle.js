import { makeStyles } from '@material-ui/core/styles'
import ReactPropTypes from 'prop-types'
import React, { useEffect, useRef, useState } from 'react'

const useStyles = makeStyles({
  horizontalHandle: {
    cursor: 'row-resize',
    width: '100%',
  },
  verticalHandle: {
    cursor: 'col-resize',
    height: '100%',
  },
})

function ResizeHandle({ style, onDrag, vertical }) {
  const [mouseDragging, setMouseDragging] = useState(false)
  const prevPos = useRef()
  const classes = useStyles()

  useEffect(() => {
    let cleanup = () => {}

    function mouseMove(event) {
      event.preventDefault()
      const pos = event[vertical ? 'clientX' : 'clientY']
      const distance = pos - prevPos.current
      if (distance) {
        const actualDistance = onDrag(distance)
        prevPos.current += actualDistance
      }
    }

    function mouseUp() {
      prevPos.current = undefined
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
  }, [mouseDragging, onDrag, vertical])

  function mouseDown(event) {
    event.preventDefault()
    const pos = event[vertical ? 'clientX' : 'clientY']
    prevPos.current = pos
    setMouseDragging(true)
  }

  function mouseLeave(event) {
    event.preventDefault()
  }

  return (
    <div
      onMouseDown={mouseDown}
      onMouseLeave={mouseLeave}
      role="presentation"
      className={classes[vertical ? 'verticalHandle' : 'horizontalHandle']}
      style={style}
    />
  )
}

ResizeHandle.propTypes = {
  style: ReactPropTypes.shape(),
  onDrag: ReactPropTypes.func.isRequired,
  vertical: ReactPropTypes.bool,
}

ResizeHandle.defaultProps = { style: {}, vertical: false }

export default ResizeHandle
