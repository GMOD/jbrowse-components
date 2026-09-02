import HoverTooltip from '@jbrowse/core/ui/HoverTooltip'
import { assembleLocString } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { toP } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import type { WiggleHoveredFeature, WiggleTooltipRow } from '../util.ts'
import type { MouseState } from '@jbrowse/core/ui'

// Overlay-mode hits collect one row per source; cap the list so a track with
// hundreds of sources doesn't render an unbounded tooltip.
const MAX_ROWS = 8

const useStyles = makeStyles()({
  // Static bits only — `background` stays inline since it changes per source and
  // would churn emitted CSS.
  row: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  },
  swatch: {
    width: 10,
    height: 10,
    display: 'inline-block',
  },
  more: {
    fontStyle: 'italic',
    marginTop: 4,
  },
})

function ScoreText({ row }: { row: WiggleTooltipRow }) {
  return row.summary ? (
    <span>
      min:{toP(row.minScore)} avg:{toP(row.score)} max:{toP(row.maxScore)}
    </span>
  ) : (
    <span>{toP(row.score)}</span>
  )
}

function SourceRow({ row }: { row: WiggleTooltipRow }) {
  const { classes } = useStyles()
  const { source, color } = row
  return (
    <div>
      <span className={classes.row}>
        {color ? (
          <span className={classes.swatch} style={{ background: color }} />
        ) : null}
        {source ? `${source}: ` : null}
        <ScoreText row={row} />
      </span>
    </div>
  )
}

function TooltipContents({ feature }: { feature: WiggleHoveredFeature }) {
  const { classes } = useStyles()
  const { refName, start, end, rows } = feature
  return (
    <div>
      {/* start/end are 0-based half-open; assembleLocString is the shared
          1-based conversion, and collapses a single-base interval to one
          position rather than printing "101..101" */}
      {assembleLocString({ refName, start, end })}
      <br />
      {rows.slice(0, MAX_ROWS).map((row, i) => (
        // eslint-disable-next-line @eslint-react/no-array-index-key -- fixed positional list, source can be undefined for unnamed rows
        <SourceRow key={row.source ?? i} row={row} />
      ))}
      {rows.length > MAX_ROWS ? (
        <div className={classes.more}>+{rows.length - MAX_ROWS} more</div>
      ) : null}
    </div>
  )
}

// Non-plot areas (e.g. the tree sidebar) are excluded by the caller's
// `computeHit` returning undefined, not by a geometry check here — so hover and
// click-to-select share one definition of "over the plot". The cursor guides
// belong to each display component and do NOT share it: multi-wiggle's
// crosshair follows the pointer, because a row with no bin at that base is
// where the row guide is most needed.
const WiggleTooltip = observer(function WiggleTooltip({
  model,
  mouseState,
}: {
  model: { hoveredFeature?: WiggleHoveredFeature }
  mouseState: MouseState | undefined
}) {
  const { hoveredFeature } = model
  return (
    <HoverTooltip hit={hoveredFeature} mouseState={mouseState}>
      {hoveredFeature ? <TooltipContents feature={hoveredFeature} /> : null}
    </HoverTooltip>
  )
})

export default WiggleTooltip
