import { makeStyles } from '@jbrowse/core/util/tss-react'
import { toP } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import type { WiggleHoveredFeature } from '../../util.ts'

const FLAG_Z_INDEX = 800
const FLAG_FLIP_MARGIN = 90

const useStyles = makeStyles()(theme => ({
  flag: {
    position: 'absolute',
    top: 0,
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

/**
 * The score under the pointer, flying from the top of the vertical guide. One
 * row is one score; an overlay hit holds several, which the tooltip lists, so
 * the flag stays down rather than pick one.
 */
const WiggleScoreFlag = observer(function WiggleScoreFlag({
  hit,
  mouseX,
  width,
}: {
  hit: WiggleHoveredFeature | undefined
  mouseX: number
  width: number
}) {
  const { classes } = useStyles()
  const row = hit?.rows.length === 1 ? hit.rows[0] : undefined
  const flipped = mouseX > width - FLAG_FLIP_MARGIN
  return row ? (
    <div
      className={classes.flag}
      style={{
        left: mouseX,
        transform: flipped ? 'translateX(-100%)' : undefined,
      }}
    >
      {toP(row.score)}
    </div>
  ) : null
})

export default WiggleScoreFlag
