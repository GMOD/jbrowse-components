import { getBpDisplayStr } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import RemoveIcon from '@mui/icons-material/Remove'
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
  resRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    whiteSpace: 'nowrap',
  },
  iconBtn: {
    padding: 0,
  },
  icon: {
    fontSize: 15,
  },
  resValue: {
    margin: '0 2px',
  },
  resValueReset: {
    cursor: 'pointer',
    textDecoration: 'underline dotted',
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

// e.g. "25kbp (auto)" or "25kbp (+1)"; the signed bias suffix shows how far the
// user has stepped off the zoom-derived binsize.
function resolutionText(effectiveResolution: number | undefined, bias: number) {
  const value =
    effectiveResolution !== undefined ? getBpDisplayStr(effectiveResolution) : '…'
  const suffix =
    bias === 0 ? ' (auto)' : ` (${bias > 0 ? '+' : '−'}${Math.abs(bias)})`
  return `${value}${suffix}`
}

const ResolutionRow = observer(function ResolutionRow({
  model,
}: {
  model: LinearHicDisplayModel
}) {
  const { classes, cx } = useStyles()
  const { resolutionBias, effectiveResolution } = model
  const isAuto = resolutionBias === 0
  return (
    <div className={classes.resRow}>
      <span>Resolution:</span>
      <IconButton
        className={classes.iconBtn}
        size="small"
        title="Coarser"
        disabled={model.nextResolution(1) === undefined}
        onClick={() => {
          model.stepResolution(1)
        }}
      >
        <RemoveIcon className={classes.icon} />
      </IconButton>
      <IconButton
        className={classes.iconBtn}
        size="small"
        title="Finer"
        disabled={model.nextResolution(-1) === undefined}
        onClick={() => {
          model.stepResolution(-1)
        }}
      >
        <AddIcon className={classes.icon} />
      </IconButton>
      <span
        className={cx(classes.resValue, !isAuto && classes.resValueReset)}
        title={isAuto ? 'Auto (tracks zoom)' : 'Click to reset to auto'}
        onClick={
          isAuto
            ? undefined
            : () => {
                model.resetResolutionBias()
              }
        }
      >
        {resolutionText(effectiveResolution, resolutionBias)}
      </span>
      <span className={classes.spacer} />
      <IconButton
        className={classes.iconBtn}
        size="small"
        title="Hide resolution controls"
        onClick={() => {
          model.setShowResolutionControls(false)
        }}
      >
        <CloseIcon className={classes.icon} />
      </IconButton>
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
          <div className={classes.resRow}>
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
