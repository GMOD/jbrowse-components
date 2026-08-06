import { makeStyles } from '@jbrowse/core/util/tss-react'
import { alpha } from '@mui/material'
import { observer } from 'mobx-react'

import { BAND_LABEL_FONT_SIZE, BAND_LABEL_X } from './bandLabelLayout.ts'

import type { LinearMafDisplayModel } from '../stateModel.ts'

const useStyles = makeStyles()(theme => ({
  label: {
    position: 'absolute',
    left: BAND_LABEL_X,
    fontSize: BAND_LABEL_FONT_SIZE,
    lineHeight: 1,
    padding: '1px 3px',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    color: theme.palette.text.secondary,
    background: alpha(theme.palette.background.paper, 0.7),
  },
}))

// The on-screen half of the band titles. What is titled, and when, is
// `model.bandLabels` — read by the SVG export too, so an exported figure carries
// the same captions rather than two unlabelled histograms.
const MafBandLabels = observer(function MafBandLabels({
  model,
}: {
  model: LinearMafDisplayModel
}) {
  const { classes } = useStyles()
  return (
    <>
      {model.bandLabels.map(({ text, top }) => (
        <div key={text} className={classes.label} style={{ top }}>
          {text}
        </div>
      ))}
    </>
  )
})

export default MafBandLabels
