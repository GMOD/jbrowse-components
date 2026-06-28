import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import type { LinearMafDisplayModel } from '../stateModel.ts'

// Cap the legend so a many-scaffold alignment (e.g. nematode multiz) doesn't
// paper over the track; the overflow count tells the user the rest are colored
// too (every chromosome still gets its stable color regardless of the cap).
const MAX_LEGEND_ENTRIES = 14

const useStyles = makeStyles()(theme => ({
  legend: {
    position: 'absolute',
    top: 2,
    right: 2,
    zIndex: 3,
    pointerEvents: 'none',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    maxWidth: '45%',
    padding: '2px 4px',
    borderRadius: 3,
    fontSize: theme.typography.fontSize * 0.8,
    background: theme.palette.background.paper,
    opacity: 0.9,
    border: `1px solid ${theme.palette.divider}`,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    whiteSpace: 'nowrap',
  },
  swatch: {
    width: 9,
    height: 9,
    borderRadius: 2,
    flexShrink: 0,
  },
}))

/**
 * Compact legend for the color-by-source-chromosome SV mode: each distinct
 * source chromosome in view with its swatch, so a color change along a row can
 * be read as a specific chromosome. Renders nothing outside that mode.
 */
const MafSourceChromLegend = observer(function MafSourceChromLegend({
  model,
}: {
  model: LinearMafDisplayModel
}) {
  const { classes } = useStyles()
  const entries = model.visibleSourceChromosomes
  if (entries.length === 0) {
    return null
  }
  const shown = entries.slice(0, MAX_LEGEND_ENTRIES)
  const overflow = entries.length - shown.length
  return (
    <div className={classes.legend}>
      {shown.map(({ chr, color }) => (
        <div key={chr} className={classes.item}>
          <span className={classes.swatch} style={{ background: color }} />
          {chr}
        </div>
      ))}
      {overflow > 0 ? (
        <div className={classes.item}>+{overflow} more</div>
      ) : null}
    </div>
  )
})

export default MafSourceChromLegend
