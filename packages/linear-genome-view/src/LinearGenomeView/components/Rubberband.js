import { makeStyles } from '@material-ui/core/styles'
import { PropTypes as MobxPropTypes } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React, { useRef, useEffect, useState } from 'react'

const useStyles = makeStyles(theme => ({
  rubberband: {
    height: '10000px',
    background: '#aad8',
    position: 'absolute',
    display: 'flex',
    zIndex: 9999,
  },
  rubberBandContainer: {
    background: theme.palette.grey[600],
    cursor: 'crosshair',
    width: '100%',
    height: '100%',
  },
}))

function getOffsetX(ref, clientX) {
  let offset = 0
  if (ref.current) {
    offset = ref.current.getBoundingClientRect().left
  }
  return clientX - offset
}
function Rubberband({ model, height, children }) {
  const [startX, setStartX] = useState()
  const [currentX, setCurrentX] = useState()
  const [mouseDragging, setMouseDragging] = useState(false)
  const ref = useRef()
  const classes = useStyles()

  useEffect(() => {
    let cleanup = () => {}

    function globalMouseMove(event) {
      event.preventDefault()
      setCurrentX(event.clientX)
    }

    function globalMouseUp() {
      setStartX(undefined)
      setCurrentX(undefined)
      setMouseDragging(false)
      let leftPx = startX
      let rightPx = currentX
      if (rightPx < leftPx) {
        ;[leftPx, rightPx] = [rightPx, leftPx]
      }
      if (rightPx - leftPx > 3) {
        const leftOffset = model.pxToBp(getOffsetX(ref, leftPx))
        const rightOffset = model.pxToBp(getOffsetX(ref, rightPx))
        model.moveTo(leftOffset, rightOffset)
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
  }, [currentX, model, mouseDragging, startX])

  return (
    <div
      data-testid="rubberband_container"
      className={classes.rubberBandContainer}
      role="presentation"
      ref={ref}
      onMouseDown={event => {
        event.preventDefault()
        setMouseDragging(true)
        setStartX(event.clientX)
      }}
      style={{ height }}
    >
      {startX !== undefined && currentX !== undefined ? (
        <div
          className={classes.rubberband}
          style={
            currentX < startX
              ? { left: currentX, width: startX - currentX }
              : { left: startX, width: currentX - startX }
          }
        />
      ) : null}
      {children}
    </div>
  )
}

Rubberband.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
  height: ReactPropTypes.number.isRequired,
  children: ReactPropTypes.node,
}

Rubberband.defaultProps = {
  children: undefined,
}

export default Rubberband
