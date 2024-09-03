import React, { useEffect, useState, useRef } from 'react'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()({
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

function ResizeHandle({
  onDrag,
  vertical = false,
  flexbox = false,
  className: originalClassName,
  onMouseDown,
  ...props
}: {
  onDrag: (
    lastFrameDistance: number,
    totalDistance: number,
  ) => number | undefined
  onMouseDown?: (event: React.MouseEvent) => void
  vertical?: boolean
  flexbox?: boolean
  className?: string
  [props: string]: unknown
}) {
  const [mouseDragging, setMouseDragging] = useState(false)
  const initialPosition = useRef(0)
  const prevPos = useRef(0)
  const { classes, cx } = useStyles()

  useEffect(() => {
    function mouseMove(event: MouseEvent) {
      event.preventDefault()
      const pos = vertical ? event.clientX : event.clientY
      const totalDistance = initialPosition.current - pos
      const lastFrameDistance = pos - prevPos.current
      prevPos.current = pos
      onDrag(lastFrameDistance, totalDistance)
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

  let className: string
  if (flexbox) {
    className = vertical
      ? classes.flexbox_verticalHandle
      : classes.flexbox_horizontalHandle
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
        const pos = vertical ? event.clientX : event.clientY
        initialPosition.current = pos
        prevPos.current = pos
        setMouseDragging(true)
        onMouseDown?.(event)
      }}
      className={cx(className, originalClassName)}
      {...props}
    />
  )
}

export default ResizeHandle
