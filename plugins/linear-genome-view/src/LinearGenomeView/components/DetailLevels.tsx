import { Fragment } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useResizeDrag } from '@jbrowse/core/util/useResizeDrag'
import { observer } from 'mobx-react'

import {
  DETAIL_FRAME_WIDTH,
  detailLevelColor,
  detailStackRows,
} from '../detailLevels.ts'
import LinearGenomeView from './LinearGenomeView.tsx'
import OverviewScalebarPolygon from './OverviewScalebarPolygon.tsx'

import type { LinearGenomeViewModel } from '../index.ts'

const useStyles = makeStyles()(theme => ({
  connector: {
    position: 'relative',
  },
  polygon: {
    display: 'block',
    width: '100%',
    height: '100%',
    overflow: 'visible',
    pointerEvents: 'none',
  },
  level: {
    position: 'relative',
    '&::after': {
      content: '""',
      position: 'absolute',
      inset: 0,
      border: `${DETAIL_FRAME_WIDTH}px solid ${detailLevelColor(theme)}`,
      pointerEvents: 'none',
      zIndex: 1,
    },
  },
  // The whole band is the handle — a 4px bar under a 16px trapezoid is a
  // smaller target than the shape it sizes — and `useResizeDrag` rather than
  // `ResizeHandle` because that one's hover paints its whole surface, which
  // here is the figure. A rule at the edge it drags says the same thing over
  // the top of nothing.
  grab: {
    position: 'absolute',
    inset: 0,
    cursor: 'row-resize',
    touchAction: 'none',
    '&:hover': {
      borderBottom: `2px solid ${theme.palette.action.disabled}`,
    },
  },
}))

/**
 * The trapezoid from the span `level` shows, as it sits in `context`, out to
 * `level`'s full width: the header overview's "you are here", drawn between two
 * rows of the stack instead. A detail level is scrolled, where the header
 * overview never is, so its left edge is what its origin is shifted by.
 *
 * Its height belongs to the stack rather than to this pair, so a drag on any
 * band moves all of them: the bands are a ladder the eye reads down, and one
 * rung of its own height reads as a difference in the data. The height is worth
 * dragging at all because the band is a picture of a ratio — a row ten times
 * wider than the one under it narrows to a tenth of the width there — and how
 * steep that reads is the figure's to decide, not ours.
 */
const LevelConnector = observer(function LevelConnector({
  host,
  context,
  level,
}: {
  host: LinearGenomeViewModel
  context: LinearGenomeViewModel
  level: LinearGenomeViewModel
}) {
  const { classes } = useStyles()
  const height = host.detailConnectorHeight
  const handleProps = useResizeDrag({
    onDrag: delta => {
      host.setDetailConnectorHeight(host.detailConnectorHeight + delta)
    },
  })
  return context.initialized && level.initialized ? (
    <div className={classes.connector} style={{ height }}>
      <svg className={classes.polygon}>
        <OverviewScalebarPolygon
          model={level}
          overview={context}
          overviewOffsetPx={-context.offsetPx}
          height={height}
          gradient
        />
      </svg>
      <div
        {...handleProps}
        data-testid={`detail-connector-${level.id}`}
        className={classes.grab}
      />
    </div>
  ) : null
})

const DetailLevels = observer(function DetailLevels({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const levels = model.detailLevelViews as LinearGenomeViewModel[]
  const { classes } = useStyles()
  const rows = detailStackRows(model, levels)
  return rows.length ? (
    <div data-testid={`detail-levels-${model.id}`}>
      {rows.map(({ level, context }) => (
        <Fragment key={level.id}>
          <LevelConnector host={model} context={context} level={level} />
          <div className={classes.level}>
            <LinearGenomeView model={level} />
          </div>
        </Fragment>
      ))}
    </div>
  ) : null
})

export default DetailLevels
