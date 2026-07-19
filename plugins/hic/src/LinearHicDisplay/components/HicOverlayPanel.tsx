import { getBpDisplayStr } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { TrackOverlayPortal } from '@jbrowse/plugin-linear-genome-view'
import CloseIcon from '@mui/icons-material/Close'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
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
    // portaled into the pointer-events:none overlay node; re-enable events so
    // the resolution dropdown / close / reset controls stay interactive
    pointerEvents: 'auto',
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
  // reserve the reset button's slot so the row doesn't reflow when it appears
  resetSlot: {
    width: 18,
    display: 'flex',
  },
  gradientBar: {
    width: 100,
    height: 10,
    border: `1px solid ${theme.palette.divider}`,
    // clip the gradient to the padding box so it doesn't paint under the
    // translucent divider border — otherwise the border composites over the
    // gradient's red end and the left edge renders a dark-red sliver at 0
    backgroundClip: 'padding-box',
  },
  labels: {
    display: 'flex',
    justifyContent: 'space-between',
  },
}))

// A juicebox-style binsize dropdown. The list is pure binsizes (no "Auto"
// entry, which read as just another size); auto is simply the default, and a
// reset-to-auto button surfaces only once the user has locked to a size — so
// the common case is a plain "Resolution: 25 kbp" with nothing extra to parse.
const ResolutionRow = observer(function ResolutionRow({
  model,
}: {
  model: LinearHicDisplayModel
}) {
  const { classes } = useStyles()
  const { resolutionBias, effectiveResolution, availableResolutions } = model
  return (
    <div className={classes.row}>
      <span>Resolution:</span>
      <select
        className={classes.select}
        value={effectiveResolution ?? ''}
        onChange={event => {
          model.setResolution(Number(event.target.value))
        }}
      >
        {availableResolutions?.map(bin => (
          <option key={bin} value={bin}>
            {getBpDisplayStr(bin)}
          </option>
        ))}
      </select>
      <span className={classes.resetSlot}>
        {resolutionBias === 0 ? null : (
          <Tooltip title="Back to auto (tracks zoom)">
            <IconButton
              className={classes.iconBtn}
              size="small"
              onClick={() => {
                model.resetResolutionBias()
              }}
            >
              <RestartAltIcon className={classes.icon} />
            </IconButton>
          </Tooltip>
        )}
      </span>
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
    hasLegendData,
    showResolutionControls,
    availableResolutions,
  } = model

  const showLegendArea = showLegend && hasLegendData
  const showResArea = showResolutionControls && !!availableResolutions?.length
  if (!showLegendArea && !showResArea) {
    return null
  }

  const { minLabel, maxLabel } = getHicScaleLabels(colorMaxScore, useLogScale)
  // portal above the inter-region padding masks so the panel isn't buried at
  // whole-genome / multi-region scale (see TrackOverlayPortal)
  return (
    <TrackOverlayPortal>
      <div className={classes.panel}>
        {showResArea ? <ResolutionRow model={model} /> : null}
        {showLegendArea ? (
          <>
            <div className={classes.row}>
              <span>Contacts</span>
              <span className={classes.spacer} />
              <Tooltip title="Hide legend">
                <IconButton
                  className={classes.iconBtn}
                  size="small"
                  onClick={() => {
                    model.setShowLegend(false)
                  }}
                >
                  <CloseIcon className={classes.icon} />
                </IconButton>
              </Tooltip>
            </div>
            <div
              className={classes.gradientBar}
              // backgroundImage (longhand), not the `background` shorthand: the
              // shorthand resets background-clip back to border-box, undoing the
              // padding-box clip and re-introducing the dark-red sliver at 0
              style={{ backgroundImage: getLegendCssGradient(colorScheme) }}
            />
            <div className={classes.labels}>
              <span>{minLabel}</span>
              <span>{maxLabel}</span>
            </div>
          </>
        ) : null}
      </div>
    </TrackOverlayPortal>
  )
})

export default HicOverlayPanel
