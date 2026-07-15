import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '../index.ts'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()(theme => ({
  // spans the full staticBlocks width; labels are absolutely positioned within
  // it so a label on an internal (~800px) block boundary is no longer clipped
  container: {
    position: 'relative',
    height: 13,
    overflow: 'hidden',
  },
  tick: {
    position: 'absolute',
    width: 0,
    display: 'flex',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  tickLabel: {
    fontSize: 11,
    zIndex: 1,
    lineHeight: 'normal',
    pointerEvents: 'none',
    // paper backing so the number stays readable over the gridline behind it
    background: theme.palette.background.paper,
    padding: '0 2px',
  },
}))

const ScalebarCoordinateLabels = observer(function ScalebarCoordinateLabels({
  model,
}: {
  model: LGV
}) {
  const { classes } = useStyles()
  const { scalebarLabels, staticBlocks } = model

  return (
    <div
      className={classes.container}
      style={{ width: staticBlocks.totalWidthPx }}
    >
      {/* key by base within each run (in scalebarLabels): getTickDisplayStr text
      depends only on base, so reusing nodes keeps their text stable during zoom */}
      {scalebarLabels.map(({ x, label, key }) => (
        <div
          key={key}
          className={classes.tick}
          style={{ transform: `translateX(${x}px)` }}
        >
          <div className={classes.tickLabel}>{label}</div>
        </div>
      ))}
    </div>
  )
})

export default ScalebarCoordinateLabels
