import { useCallback, useEffect, useRef, useState } from 'react'

import { cx, makeStyles } from '../util/tss-react/index.ts'
import { useEventCallback } from '../util/useEventCallback.ts'

const useStyles = makeStyles()(theme => ({
  horizontalHandle: {
    cursor: 'row-resize',
    width: '100%',
    '&:hover': { background: theme.palette.action.selected },
  },
  verticalHandle: {
    cursor: 'col-resize',
    height: '100%',
    '&:hover': { background: theme.palette.action.selected },
  },
  // `bar` opt-in: the standard always-visible resize divider used at the bottom
  // (or side) of views and tracks. Other call sites stay invisible until hover.
  horizontalBar: { height: 4, background: theme.palette.divider },
  verticalBar: { width: 4, background: theme.palette.divider },
}))

function ResizeHandle({
  onDrag,
  onDragStart,
  onDragEnd,
  vertical = false,
  bar = false,
  className: originalClassName,
  onMouseDown,
  ...props
}: {
  onDrag: (distance: number) => void
  onDragStart?: () => void
  onDragEnd?: () => void
  vertical?: boolean
  bar?: boolean
} & Omit<
  React.ComponentPropsWithoutRef<'div'>,
  'onDrag' | 'onDragStart' | 'onDragEnd'
>) {
  const [mouseDragging, setMouseDragging] = useState(false)
  const prevPosRef = useRef(0)
  const latestPosRef = useRef(0)
  const scheduledRef = useRef(false)
  const { classes } = useStyles()
  const onDragStable = useEventCallback(onDrag)
  const onDragStartStable = useEventCallback(() => onDragStart?.())
  const onDragEndStable = useEventCallback(() => onDragEnd?.())

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
      onDragEndStable()
    }

    window.addEventListener('mousemove', mouseMove, true)
    window.addEventListener('mouseup', mouseUp, true)
    return () => {
      window.removeEventListener('mousemove', mouseMove, true)
      window.removeEventListener('mouseup', mouseUp, true)
    }
  }, [mouseDragging, onDragStable, onDragEndStable, getPos])

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault()
      const pos = getPos(event)
      prevPosRef.current = pos
      latestPosRef.current = pos
      setMouseDragging(true)
      onDragStartStable()
      onMouseDown?.(event)
    },
    [getPos, onMouseDown, onDragStartStable],
  )

  return (
    <div
      data-resizer="true"
      onMouseDown={handleMouseDown}
      className={cx(
        originalClassName,
        vertical ? classes.verticalHandle : classes.horizontalHandle,
        bar && (vertical ? classes.verticalBar : classes.horizontalBar),
      )}
      {...props}
    />
  )
}

export default ResizeHandle
