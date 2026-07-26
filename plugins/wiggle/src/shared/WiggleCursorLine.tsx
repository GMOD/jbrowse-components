import { makeStyles } from '@jbrowse/core/util/tss-react'

const useStyles = makeStyles()({
  // `left`/`height` stay inline: they change per mouse move and would churn
  // emitted CSS.
  cursorLine: {
    position: 'absolute',
    top: 0,
    width: 1,
    background: '#777',
    pointerEvents: 'none',
  },
})

/**
 * Vertical genomic guide at the cursor. The single-source displays use this
 * rather than the shared `Crosshairs`: their y axis is score and they already
 * draw score gridlines (`CrossHatches`), so a second horizontal line at the
 * cursor would read as another threshold. Multi-wiggle, whose y also picks a
 * row, takes the full crosshair.
 */
export default function WiggleCursorLine({
  height,
  left,
}: {
  height: number
  left: number
}) {
  const { classes } = useStyles()
  return <div className={classes.cursorLine} style={{ height, left }} />
}
