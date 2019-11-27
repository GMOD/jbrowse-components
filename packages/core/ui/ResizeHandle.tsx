import { makeStyles } from '@material-ui/core/styles'
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
  // eslint-disable-next-line @typescript-eslint/camelcase
  flexbox_verticalHandle: {
    cursor: 'col-resize',
    alignSelf: 'stretch', // the height: 100% is actually unable to function inside flexbox
  },
  // eslint-disable-next-line @typescript-eslint/camelcase
  flexbox_horizontalHandle: {
    cursor: 'row-resize',
    alignSelf: 'stretch', // similar to above
  },
})

interface ResizeHandleProps {
  onDrag: Function
  vertical?: boolean
  flexbox?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [props: string]: any
}

function ResizeHandle({
  onDrag,
  vertical = false,
  flexbox = false,
  ...props
}: ResizeHandleProps) {
  const [mouseDragging, setMouseDragging] = useState(false)
  const prevPos: React.MutableRefObject<number | undefined> = useRef()
  const classes = useStyles()

  useEffect(() => {
    let cleanup = () => {}

    function mouseMove(event: MouseEvent) {
      event.preventDefault()
      const pos = event[vertical ? 'clientX' : 'clientY']
      const distance = prevPos.current && pos - prevPos.current
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

  function mouseDown(event: React.MouseEvent) {
    event.preventDefault()
    const pos = event[vertical ? 'clientX' : 'clientY']
    prevPos.current = pos
    setMouseDragging(true)
  }

  function mouseLeave(event: React.MouseEvent) {
    event.preventDefault()
  }

  let className
  if (flexbox) {
    if (vertical) className = classes.flexbox_verticalHandle
    else className = classes.flexbox_horizontalHandle
  } else if (vertical) className = classes.verticalHandle
  else className = classes.horizontalHandle

  return (
    <div
      onMouseDown={mouseDown}
      onMouseLeave={mouseLeave}
      role="presentation"
      className={className}
      {...props}
    />
  )
}

export default ResizeHandle
