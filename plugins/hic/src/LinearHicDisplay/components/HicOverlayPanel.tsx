import { getBpDisplayStr } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { TrackOverlayPortal } from '@jbrowse/display-ui'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import { observer } from 'mobx-react'

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

// The juicebox-style resolution box, in its own portal above the plot. The
// color key beside it is the chrome's, off `colorScales`.
const HicOverlayPanel = observer(function HicOverlayPanel({
  model,
}: {
  model: LinearHicDisplayModel
}) {
  const { classes } = useStyles()
  return model.showResolutionBox ? (
    // portal above the inter-region padding masks so the box isn't buried at
    // whole-genome / multi-region scale (see TrackOverlayPortal)
    <TrackOverlayPortal>
      <div
        className={classes.panel}
        // same reason as FloatingLegend: a panel that takes pointer events
        // must claim the press, or dragging its text pans the view underneath
        data-gesture-owner="true"
      >
        <ResolutionRow model={model} />
      </div>
    </TrackOverlayPortal>
  ) : null
})

export default HicOverlayPanel
