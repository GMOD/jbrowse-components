import { Fragment } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useResizeDrag } from '@jbrowse/core/util/useResizeDrag'
import { observer } from 'mobx-react'

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
    pointerEvents: 'none',
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
 * The trapezoid from the span `lower` shows, as it sits in `upper`, down to
 * `lower`'s full width: the header overview's "you are here", drawn between
 * two levels instead. The upper level is scrolled, where the header overview
 * never is, so its left edge is what its origin is shifted by.
 *
 * Its height belongs to the stack rather than to this pair, so a drag on any
 * band moves all of them: the bands are a ladder the eye reads down, and one
 * rung of its own height reads as a difference in the data. The height is worth
 * dragging at all because the band is a picture of a ratio — a level ten times
 * wider than the row below narrows to a tenth of the width over it — and how
 * steep that reads is the figure's to decide, not ours.
 */
const LevelConnector = observer(function LevelConnector({
  host,
  upper,
  lower,
}: {
  host: LinearGenomeViewModel
  upper: LinearGenomeViewModel
  lower: LinearGenomeViewModel
}) {
  const { classes } = useStyles()
  const height = host.contextConnectorHeight
  const handleProps = useResizeDrag({
    onDrag: delta => {
      host.setContextConnectorHeight(host.contextConnectorHeight + delta)
    },
  })
  return upper.initialized && lower.initialized ? (
    <div className={classes.connector} style={{ height }}>
      <svg className={classes.polygon}>
        <OverviewScalebarPolygon
          model={lower}
          overview={upper}
          overviewOffsetPx={-upper.offsetPx}
          height={height}
          gradient
        />
      </svg>
      <div
        {...handleProps}
        data-testid={`context-connector-${upper.id}`}
        className={classes.grab}
      />
    </div>
  ) : null
})

const ContextLevels = observer(function ContextLevels({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const levels = model.contextLevelViews as LinearGenomeViewModel[]
  return levels.length ? (
    <div data-testid={`context-levels-${model.id}`}>
      {levels.map((level, i) => (
        <Fragment key={level.id}>
          <LinearGenomeView model={level} />
          <LevelConnector
            host={model}
            upper={level}
            lower={levels[i + 1] ?? model}
          />
        </Fragment>
      ))}
    </div>
  ) : null
})

export default ContextLevels
