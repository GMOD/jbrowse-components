import { Fragment } from 'react'

import ResizeHandle from '@jbrowse/core/ui/ResizeHandle'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import LinearGenomeView from './LinearGenomeView.tsx'
import OverviewScalebarPolygon from './OverviewScalebarPolygon.tsx'

import type { LinearGenomeViewModel } from '../index.ts'

const useStyles = makeStyles()({
  connector: {
    position: 'relative',
  },
  polygon: {
    display: 'block',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  },
  // the whole band is the handle: it is the only thing drawn in it, and a 4px
  // bar under a 16px trapezoid is a smaller target than the shape it resizes
  grab: {
    position: 'absolute',
    inset: 0,
  },
})

/**
 * The trapezoid from the span `lower` shows, as it sits in `upper`, down to
 * `lower`'s full width: the header overview's "you are here", drawn between
 * two levels instead. The upper level is scrolled, where the header overview
 * never is, so its left edge is what its origin is shifted by.
 *
 * Its height is `upper`'s to keep, and dragging the band is how it is set. The
 * band is a picture of a ratio — a level ten times wider than the row below
 * narrows to a tenth of the width over the band's height — and how steep that
 * reads is the figure's to decide, not ours.
 */
const LevelConnector = observer(function LevelConnector({
  upper,
  lower,
}: {
  upper: LinearGenomeViewModel
  lower: LinearGenomeViewModel
}) {
  const { classes } = useStyles()
  const height = upper.contextConnectorHeight
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
      <ResizeHandle
        className={classes.grab}
        onDrag={delta => {
          upper.setContextConnectorHeight(height + delta)
        }}
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
          <LevelConnector upper={level} lower={levels[i + 1] ?? model} />
        </Fragment>
      ))}
    </div>
  ) : null
})

export default ContextLevels
