import { makeStyles } from '@material-ui/core/styles'
import clsx from 'clsx'
import React, { useEffect, useState, useRef } from 'react'

const useStyles = makeStyles({
  horizontalHandle: {
    cursor: 'row-resize',
    width: '100%',
  },
  verticalHandle: {
    cursor: 'col-resize',
    height: '100%',
  },
  flexbox_verticalHandle: {
    cursor: 'col-resize',
    alignSelf: 'stretch', // the height: 100% is actually unable to function inside flexbox
  },
  flexbox_horizontalHandle: {
    cursor: 'row-resize',
    alignSelf: 'stretch', // similar to above
  },
})

interface ResizeHandleProps {
  onDrag: (arg: number) => number
  vertical?: boolean
  flexbox?: boolean
  className?: string
  [props: string]: unknown
}

function ResizeHandle({
  onDrag,
  vertical = false,
  flexbox = false,
  className: originalClassName,
  ...props
}: ResizeHandleProps) {
  const [mouseDragging, setMouseDragging] = useState(false)
  const prevPos = useRef(0)
  const classes = useStyles()

  useEffect(() => {
    function mouseMove(event: MouseEvent) {
      event.preventDefault()
      const pos = event[vertical ? 'clientX' : 'clientY']
      const distance = pos - prevPos.current
      if (distance) {
        const actualDistance = onDrag(distance)
        prevPos.current += actualDistance
      }
    }

    function mouseUp() {
      setMouseDragging(false)
    }
    if (mouseDragging) {
      window.addEventListener('mousemove', mouseMove, true)
      window.addEventListener('mouseup', mouseUp, true)
      return () => {
        window.removeEventListener('mousemove', mouseMove, true)
        window.removeEventListener('mouseup', mouseUp, true)
      }
    }
    return () => {}
  }, [mouseDragging, onDrag, vertical])

  let className
  if (flexbox) {
    if (vertical) {
      className = classes.flexbox_verticalHandle
    } else {
      className = classes.flexbox_horizontalHandle
    }
  } else if (vertical) {
    className = classes.verticalHandle
  } else {
    className = classes.horizontalHandle
  }

  return (
    <div
      data-resizer="true"
      onMouseDown={event => {
        event.preventDefault()
        const pos = event[vertical ? 'clientX' : 'clientY']
        prevPos.current = pos
        setMouseDragging(true)
      }}
      role="presentation"
      className={clsx(className, originalClassName)}
      {...props}
    />
  )
}

export default ResizeHandle
