import { makeStyles } from '@jbrowse/core/util/tss-react'
import CloseIcon from '@mui/icons-material/Close'
import IconButton from '@mui/material/IconButton'
import { observer } from 'mobx-react'

import { getLegendCssGradient } from './colorRamp.ts'
import { getHicScaleLabels } from './scaleLabels.ts'

import type { LinearHicDisplayModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  panel: {
    position: 'absolute',
    right: 4,
    top: 4,
    background: theme.palette.background.paper,
    color: theme.palette.text.primary,
    border: `1px solid ${theme.palette.divider}`,
    padding: 4,
    fontSize: 10,
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  close: {
    padding: 0,
  },
  gradientBar: {
    width: 100,
    height: 10,
    border: `1px solid ${theme.palette.divider}`,
  },
  labels: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  normLabel: {
    color: theme.palette.text.secondary,
  },
}))

const HicOverlayPanel = observer(function HicOverlayPanel({
  model,
}: {
  model: LinearHicDisplayModel
}) {
  const { classes } = useStyles()
  const {
    colorMaxScore,
    colorScheme,
    useLogScale,
    showLegend,
    availableNormalizations,
    activeNormalization,
  } = model

  if (!(showLegend && colorMaxScore > 0)) {
    return null
  }

  const { minLabel, maxLabel } = getHicScaleLabels(colorMaxScore, useLogScale)
  return (
    <div className={classes.panel}>
      <div className={classes.header}>
        <span>Contacts</span>
        <IconButton
          className={classes.close}
          size="small"
          title="Hide legend"
          onClick={() => {
            model.setShowLegend(false)
          }}
        >
          <CloseIcon fontSize="inherit" />
        </IconButton>
      </div>
      <div
        className={classes.gradientBar}
        style={{ background: getLegendCssGradient(colorScheme) }}
      />
      <div className={classes.labels}>
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
      {availableNormalizations && availableNormalizations.length > 1 ? (
        <div
          className={classes.normLabel}
          title="Normalization (change in track menu)"
        >
          norm: {activeNormalization}
        </div>
      ) : null}
    </div>
  )
})

export default HicOverlayPanel
