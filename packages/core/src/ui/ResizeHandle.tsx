import { useCallback, useEffect, useRef, useState } from 'react'

import { cx, makeStyles } from '../util/tss-react/index.ts'
import { useEventCallback } from '../util/useEventCallback.ts'

const useStyles = makeStyles()(theme => ({
  horizontalHandle: {
    cursor: 'row-resize',
    width: '100%',
    '&:hover': { background: theme.palette.divider },
  },
  verticalHandle: {
    cursor: 'col-resize',
    height: '100%',
    '&:hover': { background: theme.palette.divider },
  },
}))

function ResizeHandle({
  onDrag,
  vertical = false,
  className: originalClassName,
  onMouseDown,
  ...props
}: {
  onDrag: (distance: number) => void
  onMouseDown?: (event: React.MouseEvent) => void
  vertical?: boolean
  className?: string
  [props: string]: unknown
}) {
  const [mouseDragging, setMouseDragging] = useState(false)
  const prevPosRef = useRef(0)
  const latestPosRef = useRef(0)
  const scheduledRef = useRef(false)
  const { classes } = useStyles()
  const onDragStable = useEventCallback(onDrag)

  const getPos = useCallback(
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
      latestPosRef.current = getPos(event)
      if (!scheduledRef.current) {
        scheduledRef.current = true
        requestAnimationFrame(() => {
          const distance = latestPosRef.current - prevPosRef.current
          prevPosRef.current = latestPosRef.current
          onDragStable(distance)
          scheduledRef.current = false
        })
      }
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
  }, [mouseDragging, onDragStable, getPos])

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      const pos = getPos(event)
      prevPosRef.current = pos
      latestPosRef.current = pos
      setMouseDragging(true)
      onMouseDown?.(event)
    },
    [getPos, onMouseDown],
  )

  return (
    <div
      data-resizer="true"
      onMouseDown={handleMouseDown}
      className={cx(
        originalClassName,
        vertical ? classes.verticalHandle : classes.horizontalHandle,
      )}
      {...props}
    />
  )
}

export default ResizeHandle
