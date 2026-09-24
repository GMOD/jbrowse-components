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
    // the overlay node it is portalled into takes no pointer events
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
  resetSlot: {
    width: 18,
    display: 'flex',
  },
}))

// A juicebox-style binsize dropdown. Auto is the default rather than an entry,
// and the reset button appears once a size is locked.
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
  return model.showResolutionBox ? (
    <TrackOverlayPortal>
      <div
        className={classes.panel}
        // claims the press, or dragging its text pans the view
        data-gesture-owner="true"
      >
        <ResolutionRow model={model} />
      </div>
    </TrackOverlayPortal>
  ) : null
})

export default HicOverlayPanel
