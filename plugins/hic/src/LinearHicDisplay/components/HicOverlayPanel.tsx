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
    right: 10,
    top: 10,
    background: theme.palette.background.paper,
    color: theme.palette.text.primary,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 4,
    padding: 8,
    fontSize: 11,
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  caption: {
    fontSize: 10,
    color: theme.palette.text.secondary,
  },
  gradientBar: {
    width: 100,
    height: 12,
    borderRadius: 2,
    border: `1px solid ${theme.palette.divider}`,
  },
  labels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 10,
  },
  normLabel: {
    fontSize: 10,
    textAlign: 'center',
    color: theme.palette.text.secondary,
  },
  legendHeader: {
    display: 'flex',
    justifyContent: 'flex-end',
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

  return (
    <div className={classes.panel}>
      <div className={classes.legendHeader}>
        <IconButton
          size="small"
          title="Hide legend"
          onClick={() => {
            model.setShowLegend(false)
          }}
        >
          <CloseIcon fontSize="inherit" />
        </IconButton>
      </div>
      <div className={classes.caption}>Contacts</div>
      <div
        className={classes.gradientBar}
        style={{ background: getLegendCssGradient(colorScheme) }}
      />
      <Labels score={colorMaxScore} useLogScale={useLogScale} />
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

const Labels = observer(function Labels({
  score,
  useLogScale,
}: {
  score: number
  useLogScale: boolean
}) {
  const { classes } = useStyles()
  const { minLabel, maxLabel } = getHicScaleLabels(score, useLogScale)
  return (
    <div className={classes.labels}>
      <span>{minLabel}</span>
      <span>{maxLabel}</span>
    </div>
  )
})

export default HicOverlayPanel
