import { observer } from 'mobx-react'

import { cx, makeStyles } from '../util/tss-react/index.ts'
import { useResizeDrag } from '../util/useResizeDrag.ts'

import type React from 'react'

const layer = (color: string) => `linear-gradient(${color}, ${color})`

// Three kinds of handle, one ladder of weight between them. A handle that draws
// nothing at rest reveals itself under the pointer at exactly the weight a
// visible one rests at (`action.disabled`); a visible one then goes past that,
// to `action.active` — the same resting/hover pair `VerticalScrollbar`'s thumb
// uses. A `grip` bar sits on an opaque paper fill so a view's gridlines stop at
// it, and a centred pill marks it as something to grab. `grip="hover"` draws
// that grip only under the pointer or mid-drag.
const useStyles = makeStyles()(theme => ({
  horizontalHandle: {
    cursor: 'row-resize',
    width: '100%',
    // stop the browser turning a touch-drag into a scroll/pan gesture so the
    // pointer stream reaches us
    touchAction: 'none',
    '&:hover': { backgroundColor: theme.palette.action.disabled },
  },
  verticalHandle: {
    cursor: 'col-resize',
    height: '100%',
    touchAction: 'none',
    '&:hover': { backgroundColor: theme.palette.action.disabled },
  },
  // `bar` opt-in: the standard always-visible resize divider used at the bottom
  // (or side) of views and tracks. Other call sites stay invisible until hover.
  bar: { '&:hover': { background: theme.palette.action.active } },
  horizontalBar: { height: 4, background: theme.palette.action.disabled },
  verticalBar: { width: 4, background: theme.palette.action.disabled },
  grip: {
    backgroundColor: theme.palette.background.paper,
    backgroundImage: `${layer(theme.palette.text.disabled)}, ${layer(theme.palette.action.disabled)}`,
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    '&:hover': {
      backgroundColor: theme.palette.background.paper,
      backgroundImage: `${layer(theme.palette.text.secondary)}, ${layer(theme.palette.text.disabled)}`,
    },
  },
  gripOnHover: {
    '&:not(:hover):not(:active)': {
      backgroundColor: 'transparent',
      backgroundImage: 'none',
      borderColor: 'transparent',
    },
  },
  horizontalGrip: {
    height: 6,
    backgroundSize: '24px 3px, auto',
    borderTop: `1px solid ${theme.palette.text.disabled}`,
  },
  verticalGrip: {
    width: 6,
    backgroundSize: '3px 24px, auto',
    borderLeft: `1px solid ${theme.palette.text.disabled}`,
  },
}))

const ResizeHandle = observer(function ResizeHandle({
  onDrag,
  onDragStart,
  onDragEnd,
  vertical = false,
  bar = false,
  grip = false,
  gain,
  className: originalClassName,
  onPointerDown,
  ...props
}: {
  onDrag: (distance: number) => void
  onDragStart?: () => void
  onDragEnd?: () => void
  vertical?: boolean
  bar?: boolean
  /** An opaque `bar` with a grip pill, for the bottom edge of a view */
  grip?: boolean | 'hover'
  /**
   * How many px this handle moves per px of the value it drags — see
   * `useResizeDrag`. Pass it when the value is shared by several stacked bands
   * and this handle sits below more than one of them.
   */
  gain?: number
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
    gain,
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
        grip && [
          classes.grip,
          vertical ? classes.verticalGrip : classes.horizontalGrip,
          grip === 'hover' && classes.gripOnHover,
        ],
        bar &&
          !grip && [
            classes.bar,
            vertical ? classes.verticalBar : classes.horizontalBar,
          ],
      )}
      {...handleProps}
      onPointerDown={event => {
        handleProps.onPointerDown(event)
        onPointerDown?.(event)
      }}
    />
  )
})

export default ResizeHandle
