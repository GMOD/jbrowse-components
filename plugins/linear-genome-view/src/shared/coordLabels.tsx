import { makeStyles } from '@jbrowse/core/util/tss-react'
import { alpha } from '@mui/material'

// half the space reserved for a guide label, so it stays inside the view near
// the edges. this is the only thing lost by not using a popper
const HALF_LABEL_WIDTH = 60

const useStyles = makeStyles()(theme => ({
  // zero height so it takes no flow space while sticking with the scalebar.
  // sticky positioning makes this a stacking context, so the z-index has to
  // live here rather than on the labels it traps
  anchor: {
    height: 0,
    zIndex: 1002,
  },
  label: {
    position: 'absolute',
    background: alpha(theme.palette.grey[700], 0.92),
    color: theme.palette.common.white,
    borderRadius: theme.shape.borderRadius,
    padding: '2px 6px',
    fontSize: theme.typography.pxToRem(11),
    fontWeight: theme.typography.fontWeightMedium,
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
  },
  leftOfEdge: {
    right: '100%',
    marginRight: 2,
  },
  rightOfEdge: {
    left: '100%',
    marginLeft: 2,
  },
}))

function anchorStyle(stickyTop: number | undefined) {
  return stickyTop === undefined
    ? ({ position: 'relative' } as const)
    : ({ position: 'sticky', top: stickyTop } as const)
}

/**
 * Coordinate readouts riding the scalebar: one for the vertical guide, one pair
 * for the rubberband selection. Deliberately not MUI Tooltips — both are
 * permanently open and re-render on every pan frame or drag move, and an open
 * popper re-runs its whole modifier chain (~17 getBoundingClientRect calls) on
 * every render of its parent, since MUI's `BasePopper` calls `forceUpdate()`
 * from a dep-less effect. They also draw inside the tracks container, a
 * `contain: layout` stacking context the portaled popper escaped.
 *
 * Both take their vertical place from the flow, like the guide line and the
 * selection span, and `stickyTop` pins them to the scalebar they ride once that
 * scrolls away.
 */
export function GuideLabel({
  coordX,
  viewWidth,
  stickyTop,
  children,
}: {
  coordX: number
  viewWidth: number
  stickyTop: number | undefined
  children: React.ReactNode
}) {
  const { classes } = useStyles()
  const clampedX = Math.min(
    Math.max(coordX, HALF_LABEL_WIDTH),
    viewWidth - HALF_LABEL_WIDTH,
  )
  return (
    <div className={classes.anchor} style={anchorStyle(stickyTop)}>
      <div
        className={classes.label}
        style={{ transform: `translateX(${clampedX}px) translateX(-50%)` }}
      >
        {children}
      </div>
    </div>
  )
}

/**
 * The bp coordinates of a rubberband selection, one label just outside each edge
 * of the span. Renders inside the span, so the edges are its own box.
 */
export function SpanEdgeLabels({
  stickyTop,
  left,
  right,
}: {
  stickyTop: number | undefined
  left: React.ReactNode
  right: React.ReactNode
}) {
  const { classes, cx } = useStyles()
  return (
    <div className={classes.anchor} style={anchorStyle(stickyTop)}>
      <div className={cx(classes.label, classes.leftOfEdge)}>{left}</div>
      <div className={cx(classes.label, classes.rightOfEdge)}>{right}</div>
    </div>
  )
}
