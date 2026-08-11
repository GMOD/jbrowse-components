import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { TICK_LABEL_FONT_SIZE } from '../util.ts'

import type { LinearGenomeViewModel } from '../index.ts'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()(theme => ({
  // spans the full staticBlocks width; labels are absolutely positioned within
  // it so a label on an internal (~800px) block boundary is no longer clipped.
  // Absolute (with top/left left at their static position, i.e. the top-left of
  // the scalebar Paper) so a strip wider than the viewport adds no flow width
  container: {
    position: 'absolute',
    height: 13,
    pointerEvents: 'none',
    // clip rather than hidden so this never becomes a scroll container (see
    // Scalebar)
    overflow: 'clip',
  },
  tick: {
    position: 'absolute',
    width: 0,
    display: 'flex',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  tickLabel: {
    fontSize: TICK_LABEL_FONT_SIZE,
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
  const { scalebarLabels, staticBlocks, staticBlocksTranslateX } = model
  // labels are laid out in the staticBlocks frame, which overhangs the
  // viewport; shift it into view (the -1 clears the left track border, as
  // Gridlines/PaddingBlocks do with their `offset` prop). Rounded, unlike
  // ZoomTransform: these children are text, and a fractional offset blurs it.
  const offsetLeft = Math.round(staticBlocksTranslateX)

  return (
    <div
      className={classes.container}
      style={{
        width: staticBlocks.totalWidthPx,
        transform: `translateX(${offsetLeft - 1}px)`,
      }}
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
