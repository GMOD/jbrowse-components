import { cx, makeStyles } from '../util/tss-react/index.ts'
import { useResizeDrag } from '../util/useResizeDrag.ts'

import type React from 'react'

// Two kinds of handle, one ladder of weight between them. A handle that draws
// nothing at rest reveals itself under the pointer at exactly the weight a
// visible one rests at (`action.disabled`); a visible one then goes past that,
// to `action.active` — the same resting/hover pair `VerticalScrollbar`'s thumb
// uses.
//
// `action.selected` (0.08 light / 0.16 dark) used to be the hover for both, and
// was too faint to answer "is this the thing I grab?" over a dense pileup — and
// on a `bar`, which rests at 0.26, it made the handle go *fainter* under the
// pointer, since `:hover` beats the plain class whatever the source order.
const useStyles = makeStyles()(theme => ({
  horizontalHandle: {
    cursor: 'row-resize',
    width: '100%',
    // stop the browser turning a touch-drag into a scroll/pan gesture so the
    // pointer stream reaches us
    touchAction: 'none',
    '&:hover': { background: theme.palette.action.disabled },
  },
  verticalHandle: {
    cursor: 'col-resize',
    height: '100%',
    touchAction: 'none',
    '&:hover': { background: theme.palette.action.disabled },
  },
  // `bar` opt-in: the standard always-visible resize divider used at the bottom
  // (or side) of views and tracks. Other call sites stay invisible until hover.
  bar: { '&:hover': { background: theme.palette.action.active } },
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
        bar && classes.bar,
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
