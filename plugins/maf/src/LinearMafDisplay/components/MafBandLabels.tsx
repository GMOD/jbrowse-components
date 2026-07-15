import { makeStyles } from '@jbrowse/core/util/tss-react'
import { alpha } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearMafDisplayModel } from '../stateModel.ts'

const useStyles = makeStyles()(theme => ({
  label: {
    position: 'absolute',
    left: 52,
    fontSize: 9,
    lineHeight: 1,
    padding: '1px 3px',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    color: theme.palette.text.secondary,
    background: alpha(theme.palette.background.paper, 0.7),
  },
}))

// Titles the coverage and conservation bands, shown only when both are visible
// — that's the case where the two stacked filled-histogram bands are otherwise
// distinguishable only by their Y-axis units (depth vs %).
const MafBandLabels = observer(function MafBandLabels({
  model,
}: {
  model: LinearMafDisplayModel
}) {
  const { classes } = useStyles()
  const {
    showCoverage,
    showConservation,
    conservationMode,
    coverageDisplayHeight,
  } = model
  return showCoverage && showConservation ? (
    <>
      <div className={classes.label} style={{ top: 0 }}>
        Coverage
      </div>
      <div className={classes.label} style={{ top: coverageDisplayHeight }}>
        {conservationMode === 'codon'
          ? 'Conservation (aa identity)'
          : 'Conservation (% identity)'}
      </div>
    </>
  ) : null
})

export default MafBandLabels
