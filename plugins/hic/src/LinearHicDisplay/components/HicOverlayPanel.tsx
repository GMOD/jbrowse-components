import { getBpDisplayStr } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { FloatingLegend, TrackOverlayPortal } from '@jbrowse/display-ui'
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

// Where the legend starts when the resolution box holds the corner. Deliberately
// a clearance rather than a sum: the row's height is the `<select>`'s, which is
// the UA's at `fontSize: 10` and moves with the theme's font family — measured
// in Chrome at 15px under the default Roboto stack (box bottom 29, legend 33)
// and 18px under `system-ui` (box bottom 32, legend 36). 38 clears both with
// room, and erring high costs a few px of gap while erring low overlaps the box.
const RESOLUTION_ROW_CLEARANCE = 38

// The color key rides the shared `FloatingLegend` — its box, its title, its `×`
// and its gesture ownership — and supplies the one thing a row list cannot say:
// a continuous gradient. The `×` is then the same glyph `HicSVGColorLegend`
// draws, so the exported figure and the screen agree. Only the resolution
// dropdown stays bespoke, in its own portal above it.
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
    showLegendArea,
    showResolutionControls,
    hasResolutions,
  } = model

  const showResArea = showResolutionControls && hasResolutions
  const { minLabel, maxLabel } = getHicScaleLabels(colorMaxScore, useLogScale)
  return (
    <>
      {showResArea ? (
        // portal above the inter-region padding masks so the box isn't buried
        // at whole-genome / multi-region scale (see TrackOverlayPortal)
        <TrackOverlayPortal>
          <div
            className={classes.panel}
            // same reason as FloatingLegend: a panel that takes pointer events
            // must claim the press, or dragging its text pans the view
            // underneath
            data-gesture-owner="true"
          >
            <ResolutionRow model={model} />
          </div>
        </TrackOverlayPortal>
      ) : null}
      {showLegendArea ? (
        <FloatingLegend
          title="Contacts"
          top={showResArea ? RESOLUTION_ROW_CLEARANCE : undefined}
          onDismiss={() => {
            model.setShowLegend(false)
          }}
        >
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
        </FloatingLegend>
      ) : null}
    </>
  )
})

export default HicOverlayPanel
