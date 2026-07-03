import { useRef } from 'react'
import type React from 'react'

import { cx, makeStyles } from '../util/tss-react/index.ts'
import { usePointerDrag } from '../util/usePointerDrag.ts'

const useStyles = makeStyles()(theme => ({
  horizontalHandle: {
    cursor: 'row-resize',
    width: '100%',
    // stop the browser turning a touch-drag into a scroll/pan gesture so the
    // pointer stream reaches us
    touchAction: 'none',
    '&:hover': { background: theme.palette.action.selected },
  },
  verticalHandle: {
    cursor: 'col-resize',
    height: '100%',
    touchAction: 'none',
    '&:hover': { background: theme.palette.action.selected },
  },
  // `bar` opt-in: the standard always-visible resize divider used at the bottom
  // (or side) of views and tracks. Other call sites stay invisible until hover.
  horizontalBar: { height: 4, background: theme.palette.action.disabled },
  verticalBar: { width: 4, background: theme.palette.action.disabled },
}))

function ResizeHandle({
  onDrag,
  onDragStart,
  onDragEnd,
  vertical = false,
  bar = false,
  className: originalClassName,
  onPointerDown,
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
  const { classes } = useStyles()
  const prevPosRef = useRef(0)
  const latestPosRef = useRef(0)
  const scheduledRef = useRef(false)

  const getPos = (event: React.PointerEvent) =>
    vertical ? event.clientX : event.clientY

  const handlers = usePointerDrag({
    onDragStart: event => {
      const pos = getPos(event)
      prevPosRef.current = pos
      latestPosRef.current = pos
      onDragStart?.()
    },
    onDrag: event => {
      event.preventDefault()
      // snapshot the position synchronously — the deferred rAF callback runs
      // after React has nulled the event, so read it now
      latestPosRef.current = getPos(event)
      if (!scheduledRef.current) {
        scheduledRef.current = true
        requestAnimationFrame(() => {
          const distance = latestPosRef.current - prevPosRef.current
          prevPosRef.current = latestPosRef.current
          onDrag(distance)
          scheduledRef.current = false
        })
      }
    },
    onDragEnd: () => onDragEnd?.(),
  })

  return (
    <div
      data-resizer="true"
      className={cx(
        originalClassName,
        vertical ? classes.verticalHandle : classes.horizontalHandle,
        bar && (vertical ? classes.verticalBar : classes.horizontalBar),
      )}
      {...handlers}
      onPointerDown={event => {
        event.preventDefault()
        handlers.onPointerDown(event)
        onPointerDown?.(event)
      }}
      {...props}
    />
  )
}

export default ResizeHandle
