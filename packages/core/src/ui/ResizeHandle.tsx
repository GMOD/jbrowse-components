import { cx, makeStyles } from '../util/tss-react/index.ts'
import { useResizeDrag } from '../util/useResizeDrag.ts'

import type React from 'react'

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
  // The gesture, including the per-frame coalescing, the delta measurement and
  // the `data-gesture-owner` marker that keeps ancestor drags (the LGV
  // click-drag pan, MAF's drag-selection) off this press. All of it is published
  // as a hook rather than living here, because an embedder drawing their own
  // track divider needs exactly this and none of the styling below.
  const handleProps = useResizeDrag({
    onDrag,
    onDragStart,
    onDragEnd,
    vertical,
  })

  return (
    <div
      // caller props first: spread after the gesture props below, a stray
      // onPointerMove/onPointerUp would silently replace the drag's own and
      // leave a press that never resizes and never ends
      {...props}
      className={cx(
        originalClassName,
        vertical ? classes.verticalHandle : classes.horizontalHandle,
        bar && (vertical ? classes.verticalBar : classes.horizontalBar),
      )}
      {...handleProps}
      onPointerDown={event => {
        handleProps.onPointerDown(event)
        onPointerDown?.(event)
      }}
    />
  )
}

export default ResizeHandle
