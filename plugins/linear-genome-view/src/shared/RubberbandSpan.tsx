import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Typography, alpha } from '@mui/material'

import { SpanEdgeLabels } from './coordLabels.tsx'

const useStyles = makeStyles()(theme => ({
  rubberband: {
    height: '100%',
    background: alpha(theme.palette.tertiary.light, 0.7),
    position: 'absolute',
    left: 0,
    zIndex: 830,
    textAlign: 'center',
    cursor: 'crosshair',
  },
  rubberbandText: {
    color: theme.palette.tertiary.contrastText,
  },
}))

/**
 * The selection band of a rubberband drag, with its bp coordinates at the edges
 * and an optional size in the middle. Callers format their own text, since a
 * single view reads one coordinate per edge and the multi-level rubberband reads
 * one per level.
 */
export default function RubberbandSpan({
  left,
  width,
  stickyTop,
  leftLabel,
  rightLabel,
  size,
}: {
  left: number
  width: number
  stickyTop: number | undefined
  leftLabel: React.ReactNode
  rightLabel: React.ReactNode
  size?: React.ReactNode
}) {
  const { classes } = useStyles()
  return (
    <div
      className={classes.rubberband}
      style={{ transform: `translateX(${left}px)`, width }}
    >
      {/* the bp labels hang off the span itself, so they show even when there's
      no size label inside (e.g. the overview rubberband passes none) */}
      <SpanEdgeLabels
        stickyTop={stickyTop}
        left={leftLabel}
        right={rightLabel}
      />
      {size ? (
        <Typography
          variant="h6"
          className={classes.rubberbandText}
          style={
            stickyTop === undefined
              ? undefined
              : { position: 'sticky', top: stickyTop }
          }
        >
          {size}
        </Typography>
      ) : null}
    </div>
  )
}
