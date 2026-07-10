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

function ScoreText({ score, summary, minScore, maxScore }: WiggleTooltipRow) {
  return summary && minScore != null && maxScore != null ? (
    <span>
      min:{toP(minScore)} avg:{toP(score)} max:{toP(maxScore)}
    </span>
  ) : (
    <span>{toP(score)}</span>
  )
}

function SourceRow(row: WiggleTooltipRow) {
  const { classes } = useStyles()
  const { source, color } = row
  return (
    <div>
      <span className={classes.row}>
        {color ? (
          <span className={classes.swatch} style={{ background: color }} />
        ) : null}
        {source ? `${source}: ` : null}
        <ScoreText {...row} />
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
      {[refName, coord].filter(f => !!f).join(':')}
      <br />
      {rows.slice(0, MAX_ROWS).map((row, i) => (
        // eslint-disable-next-line @eslint-react/no-array-index-key -- fixed positional list, source can be undefined for unnamed rows
        <SourceRow key={row.source ?? i} {...row} />
      ))}
      {rows.length > MAX_ROWS ? (
        <div className={classes.more}>+{rows.length - MAX_ROWS} more</div>
      ) : null}
    </div>
  )
}

const WiggleTooltip = observer(function WiggleTooltip({
  model,
  clientMouseCoord,
  offsetMouseCoord,
  height,
  // Cursor x positions left of this (e.g. over the tree sidebar) suppress the
  // tooltip and vertical guide so they don't clutter the sidebar resize handle.
  minLeft = 0,
}: {
  model: { featureUnderMouse?: WiggleFeatureUnderMouse }
  clientMouseCoord: Coord
  offsetMouseCoord: Coord
  height: number
  minLeft?: number
}) {
  const { featureUnderMouse } = model
  return featureUnderMouse && offsetMouseCoord[0] >= minLeft ? (
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
