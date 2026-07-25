import { makeStyles } from '@jbrowse/core/util/tss-react'
import { alpha } from '@mui/material'

// half the space reserved for the label, so it stays inside the view near the
// edges. this is the only thing lost by not using a popper
const HALF_LABEL_WIDTH = 60

const useStyles = makeStyles()(theme => ({
  // zero height so it takes no flow space while sticking with the scalebar.
  // sticky positioning makes this a stacking context, so the z-index has to
  // live here rather than on the label it traps
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
}))

/**
 * Coordinate readout riding a vertical guide, sitting on the scalebar the guide
 * hangs from. Deliberately not a MUI Tooltip: guides are permanently open and
 * re-render on every pan frame, and an open popper re-runs its whole modifier
 * chain (~17 getBoundingClientRect calls) on every render of its parent. It
 * also has to draw inside the tracks container, a `contain: layout` stacking
 * context the portaled popper escaped.
 *
 * The wrapper takes its vertical place from the flow, like the guide line, and
 * `stickyTop` pins it to the scalebar it rides once that scrolls away.
 */
export default function GuideLabel({
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
    <div
      className={classes.anchor}
      style={
        stickyTop === undefined
          ? { position: 'relative' }
          : { position: 'sticky', top: stickyTop }
      }
    >
      <div
        className={classes.label}
        style={{ transform: `translateX(${clampedX}px) translateX(-50%)` }}
      >
        {children}
      </div>
    </div>
  )
}
