import { Fragment } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import LinearGenomeView from './LinearGenomeView.tsx'
import OverviewScalebarPolygon from './OverviewScalebarPolygon.tsx'

import type { LinearGenomeViewModel } from '../index.ts'

const CONNECTOR_HEIGHT = 16

const useStyles = makeStyles()({
  connector: {
    display: 'block',
    width: '100%',
    height: CONNECTOR_HEIGHT,
    pointerEvents: 'none',
  },
})

/**
 * The trapezoid from the span `lower` shows, as it sits in `upper`, down to
 * `lower`'s full width: the header overview's "you are here", drawn between
 * two levels instead. The upper level is scrolled, where the header overview
 * never is, so its left edge is what its origin is shifted by.
 */
const LevelConnector = observer(function LevelConnector({
  upper,
  lower,
}: {
  upper: LinearGenomeViewModel
  lower: LinearGenomeViewModel
}) {
  const { classes } = useStyles()
  return upper.initialized && lower.initialized ? (
    <svg className={classes.connector}>
      <OverviewScalebarPolygon
        model={lower}
        overview={upper}
        overviewOffsetPx={-upper.offsetPx}
        height={CONNECTOR_HEIGHT}
      />
    </svg>
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
