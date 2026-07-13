import { getBpDisplayStr } from '@jbrowse/core/util'
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
    gap: 3,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    padding: 0,
  },
  icon: {
    fontSize: 15,
  },
  select: {
    font: 'inherit',
    color: 'inherit',
    background: 'transparent',
    border: `1px solid ${theme.palette.divider}`,
  },
  spacer: {
    flex: 1,
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

// A single dropdown (juicebox-style) instead of a stepper: much less to parse.
// "Auto" tracks the zoom-derived binsize; picking a specific binsize locks to
// it via the model's bias offset.
const ResolutionRow = observer(function ResolutionRow({
  model,
}: {
  model: LinearHicDisplayModel
}) {
  const { classes } = useStyles()
  const { resolutionBias, effectiveResolution, availableResolutions } = model
  const value = resolutionBias === 0 ? 'auto' : String(effectiveResolution)
  return (
    <div className={classes.row}>
      <span>Resolution:</span>
      <select
        className={classes.select}
        value={value}
        onChange={event => {
          const v = event.target.value
          if (v === 'auto') {
            model.resetResolutionBias()
          } else {
            model.setResolution(Number(v))
          }
        }}
      >
        <option value="auto">
          Auto
          {effectiveResolution !== undefined
            ? ` (${getBpDisplayStr(effectiveResolution)})`
            : ''}
        </option>
        {availableResolutions?.map(bin => (
          <option key={bin} value={bin}>
            {getBpDisplayStr(bin)}
          </option>
        ))}
      </select>
    </div>
  )
})

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
    showResolutionControls,
    availableResolutions,
    availableNormalizations,
    activeNormalization,
  } = model

  const showLegendArea = showLegend && colorMaxScore > 0
  const showResArea =
    showResolutionControls && availableResolutions !== undefined
  if (!showLegendArea && !showResArea) {
    return null
  }

  const { minLabel, maxLabel } = getHicScaleLabels(colorMaxScore, useLogScale)
  return (
    <div className={classes.panel}>
      {showResArea ? <ResolutionRow model={model} /> : null}
      {showLegendArea ? (
        <>
          <div className={classes.row}>
            <span>Contacts</span>
            <span className={classes.spacer} />
            <IconButton
              className={classes.iconBtn}
              size="small"
              title="Hide legend"
              onClick={() => {
                model.setShowLegend(false)
              }}
            >
              <CloseIcon className={classes.icon} />
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
        </>
      ) : null}
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
