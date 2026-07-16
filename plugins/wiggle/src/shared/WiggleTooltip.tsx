import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { toLocale } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { toP } from '../util.ts'

import type { WiggleFeatureUnderMouse, WiggleTooltipRow } from '../util.ts'

// Overlay-mode hits collect one row per source; cap the list so a track with
// hundreds of sources doesn't render an unbounded tooltip.
const MAX_ROWS = 8

type Coord = [number, number]

const useStyles = makeStyles()({
  // Static bits only — `left`/`height`/`background` stay inline since they
  // change per mouse move / per source and would churn emitted CSS.
  cursorLine: {
    position: 'absolute',
    top: 0,
    width: 1,
    background: '#777',
    pointerEvents: 'none',
  },
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

function CursorLine({ height, left }: { height: number; left: number }) {
  const { classes } = useStyles()
  return <div className={classes.cursorLine} style={{ height, left }} />
}

function TooltipContents({ feature }: { feature: WiggleFeatureUnderMouse }) {
  const { classes } = useStyles()
  const { refName, start, end, rows } = feature
  const coord =
    start === end ? toLocale(start) : `${toLocale(start)}..${toLocale(end)}`
  return (
    <div>
      {`${refName}:${coord}`}
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
// `computeHit` returning undefined, not by a geometry check here — so hover, the
// vertical guide, and click-to-select share one definition of "over the plot".
const WiggleTooltip = observer(function WiggleTooltip({
  model,
  clientMouseCoord,
  offsetMouseCoord,
  height,
}: {
  model: { featureUnderMouse?: WiggleFeatureUnderMouse }
  clientMouseCoord: Coord
  offsetMouseCoord: Coord
  height: number
}) {
  const { featureUnderMouse } = model
  return featureUnderMouse ? (
    <>
      <BaseTooltip
        clientPoint={{ x: clientMouseCoord[0] + 10, y: clientMouseCoord[1] }}
      >
        <TooltipContents feature={featureUnderMouse} />
      </BaseTooltip>
      <CursorLine height={height} left={offsetMouseCoord[0]} />
    </>
  ) : null
})

export default WiggleTooltip
