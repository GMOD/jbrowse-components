import { toLocale } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { getNiceScale } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import { getLegendCssGradient } from './colorRamp.ts'

import type { LinearHicDisplayModel } from '../model.ts'

const useStyles = makeStyles()({
  panel: {
    position: 'absolute',
    right: 10,
    top: 10,
    background: 'rgba(255,255,255,0.9)',
    border: '1px solid #ccc',
    borderRadius: 4,
    padding: 8,
    fontSize: 11,
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  gradientBar: {
    width: 100,
    height: 12,
    borderRadius: 2,
  },
  labels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 10,
  },
  buttons: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
  },
  button: {
    padding: '2px 4px',
    fontSize: 10,
    border: '1px solid #ccc',
    background: '#fff',
    borderRadius: 2,
    cursor: 'pointer',
    '&:disabled': {
      cursor: 'default',
      opacity: 0.5,
    },
  },
  resLabel: {
    minWidth: 60,
    textAlign: 'center',
    fontSize: 10,
  },
  resLabelAuto: {
    fontStyle: 'italic',
  },
  resLabelClickable: {
    cursor: 'pointer',
    textDecoration: 'underline',
    textDecorationStyle: 'dotted',
  },
})

const HicOverlayPanel = observer(function HicOverlayPanel({
  model,
}: {
  model: LinearHicDisplayModel
}) {
  const { classes, cx } = useStyles()
  const {
    colorMaxScore,
    colorScheme,
    useLogScale,
    showLegend,
    resolutionBias,
    availableResolutions,
    effectiveResolution,
  } = model

  const showLegendArea = showLegend && colorMaxScore > 0
  const showButtons = availableResolutions !== undefined
  if (!showLegendArea && !showButtons) {
    return null
  }

  const isAuto = resolutionBias === 0
  const canGoFiner = model.nextResolution(-1) !== undefined
  const canGoCoarser = model.nextResolution(1) !== undefined
  const biasSuffix = isAuto
    ? ' (auto)'
    : ` (${resolutionBias > 0 ? '+' : '−'}${Math.abs(resolutionBias)})`

  return (
    <div className={classes.panel}>
      {showLegendArea ? (
        <div>
          <div
            className={classes.gradientBar}
            style={{ background: getLegendCssGradient(colorScheme) }}
          />
          <Labels score={colorMaxScore} useLogScale={useLogScale} />
        </div>
      ) : null}
      {showButtons ? (
        <div className={classes.buttons}>
          <button
            type="button"
            className={classes.button}
            disabled={!canGoFiner}
            title="Finer resolution"
            onClick={() => {
              model.stepResolution(-1)
            }}
          >
            +
          </button>
          <span
            className={cx(
              classes.resLabel,
              isAuto && classes.resLabelAuto,
              !isAuto && classes.resLabelClickable,
            )}
            title={
              isAuto ? 'Auto (tracks zoom)' : 'Click to switch back to auto'
            }
            onClick={
              isAuto
                ? undefined
                : () => {
                    model.resetResolutionBias()
                  }
            }
          >
            {effectiveResolution !== undefined
              ? `${(effectiveResolution / 1000).toFixed(0)}k`
              : '…'}
            {biasSuffix}
          </span>
          <button
            type="button"
            className={classes.button}
            disabled={!canGoCoarser}
            title="Coarser resolution"
            onClick={() => {
              model.stepResolution(1)
            }}
          >
            −
          </button>
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
  const { min, max } = getNiceScale(score, useLogScale)
  return (
    <div className={classes.labels}>
      <span>{min !== undefined ? toLocale(min) : ''}</span>
      <span>
        {max !== undefined ? toLocale(max) : ''}
        {useLogScale ? ' (log)' : ''}
      </span>
    </div>
  )
})

export default HicOverlayPanel
