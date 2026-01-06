import { useCallback, useEffect, useRef, useState } from 'react'

import { cx, makeStyles } from '../util/tss-react/index.ts'

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
  const { classes } = useStyles()

  const getPosition = useCallback(
    (event: MouseEvent | React.MouseEvent) =>
      vertical ? event.clientX : event.clientY,
    [vertical],
  )

  useEffect(() => {
    if (!mouseDragging) {
      return
    }

    function mouseMove(event: MouseEvent) {
      event.preventDefault()
      const pos = getPosition(event)
      const totalDistance = initialPosition.current - pos
      const lastFrameDistance = pos - prevPos.current
      prevPos.current = pos
      onDrag(lastFrameDistance, totalDistance)
    }

    function mouseUp() {
      setMouseDragging(false)
    }

    window.addEventListener('mousemove', mouseMove, true)
    window.addEventListener('mouseup', mouseUp, true)
    return () => {
      window.removeEventListener('mousemove', mouseMove, true)
      window.removeEventListener('mouseup', mouseUp, true)
    }
  }, [mouseDragging, onDrag, getPosition])

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      const pos = getPosition(event)
      initialPosition.current = pos
      prevPos.current = pos
      setMouseDragging(true)
      onMouseDown?.(event)
    },
    [getPosition, onMouseDown],
  )

  const className = flexbox
    ? vertical
      ? classes.flexbox_verticalHandle
      : classes.flexbox_horizontalHandle
    : vertical
      ? classes.verticalHandle
      : classes.horizontalHandle

  return (
    <div
      data-resizer="true"
      onMouseDown={handleMouseDown}
      className={cx(originalClassName, className)}
      {...props}
    />
  )
}

export default ResizeHandle
