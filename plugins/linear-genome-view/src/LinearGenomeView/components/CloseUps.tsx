import { Fragment } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useResizeDrag } from '@jbrowse/core/util/useResizeDrag'
import { observer } from 'mobx-react'

import {
  CLOSE_UP_FRAME_WIDTH,
  closeUpColor,
  closeUpStackRows,
} from '../closeUps.ts'
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
  closeUp: {
    position: 'relative',
    '&::after': {
      content: '""',
      position: 'absolute',
      inset: 0,
      border: `${CLOSE_UP_FRAME_WIDTH}px solid ${closeUpColor(theme)}`,
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
 * The trapezoid from the span `close-up` shows, as it sits in `context`, out to
 * `close-up`'s full width: the header overview's "you are here", drawn between
 * two rows of the stack instead. A close-up is scrolled, where the header
 * overview never is, so its left edge is what its origin is shifted by.
 *
 * Its height belongs to the stack rather than to this pair, so a drag on any
 * band moves all of them: the bands are a ladder the eye reads down, and one
 * rung of its own height reads as a difference in the data. The height is worth
 * dragging at all because the band is a picture of a ratio — a row ten times
 * wider than the one under it narrows to a tenth of the width there — and how
 * steep that reads is the figure's to decide, not ours.
 */
const CloseUpConnector = observer(function CloseUpConnector({
  host,
  context,
  closeUp,
}: {
  host: LinearGenomeViewModel
  context: LinearGenomeViewModel
  closeUp: LinearGenomeViewModel
}) {
  const { classes } = useStyles()
  const height = host.closeUpConnectorHeight
  const handleProps = useResizeDrag({
    onDrag: delta => {
      host.setCloseUpConnectorHeight(host.closeUpConnectorHeight + delta)
    },
  })
  return context.initialized && closeUp.initialized ? (
    <div className={classes.connector} style={{ height }}>
      <svg className={classes.polygon}>
        <OverviewScalebarPolygon
          model={closeUp}
          overview={context}
          overviewOffsetPx={-context.offsetPx}
          height={height}
          gradient
        />
      </svg>
      <div
        {...handleProps}
        data-testid={`close-up-connector-${closeUp.id}`}
        className={classes.grab}
      />
    </div>
  ) : null
})

const CloseUps = observer(function CloseUps({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const closeUps = model.closeUpViews as LinearGenomeViewModel[]
  const { classes } = useStyles()
  const rows = closeUpStackRows(model, closeUps)
  return rows.length ? (
    <div data-testid={`close-ups-${model.id}`}>
      {rows.map(({ closeUp, context }) => (
        <Fragment key={closeUp.id}>
          <CloseUpConnector host={model} context={context} closeUp={closeUp} />
          <div className={classes.closeUp}>
            <LinearGenomeView model={closeUp} />
          </div>
        </Fragment>
      ))}
    </div>
  ) : null
})

export default CloseUps
