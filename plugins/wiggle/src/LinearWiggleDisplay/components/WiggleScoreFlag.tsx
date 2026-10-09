import { rowIndexAt } from '@jbrowse/core/util/rowStackGeometry'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { toP } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import type { WiggleHoveredFeature } from '../../util.ts'

const FLAG_Z_INDEX = 800
const FLAG_FLIP_MARGIN = 90

const useStyles = makeStyles()(theme => ({
  flag: {
    position: 'absolute',
    pointerEvents: 'none',
    zIndex: FLAG_Z_INDEX,
    padding: '0 4px',
    fontSize: 11,
    lineHeight: '16px',
    whiteSpace: 'nowrap',
    color: theme.palette.text.primary,
    background: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
  },
}))

export function laneTop(
  mouseY: number,
  {
    rowsTopOffset,
    rowHeight,
    numRows,
  }: { rowsTopOffset: number; rowHeight: number; numRows: number },
) {
  const row = rowIndexAt(mouseY, { rowHeight, topOffset: rowsTopOffset })
  return rowsTopOffset + Math.min(Math.max(row, 0), numRows - 1) * rowHeight
}

/**
 * The score under the pointer, flying from the top of the hovered lane at the
 * vertical guide. One row is one score; an overlay hit holds several, which the
 * tooltip lists, so the flag stays down rather than pick one.
 */
const WiggleScoreFlag = observer(function WiggleScoreFlag({
  hit,
  mouseX,
  mouseY,
  width,
  lanes,
}: {
  hit: WiggleHoveredFeature | undefined
  mouseX: number
  mouseY: number
  width: number
  lanes: { rowsTopOffset: number; rowHeight: number; numRows: number }
}) {
  const { classes } = useStyles()
  const row = hit?.rows.length === 1 ? hit.rows[0] : undefined
  const flipped = mouseX > width - FLAG_FLIP_MARGIN
  return row ? (
    <div
      className={classes.flag}
      style={{
        left: mouseX,
        top: laneTop(mouseY, lanes),
        transform: flipped ? 'translateX(-100%)' : undefined,
      }}
    >
      {toP(row.score)}
    </div>
  ) : null
})

export default WiggleScoreFlag
