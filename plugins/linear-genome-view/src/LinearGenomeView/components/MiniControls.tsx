import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import AddIcon from '@mui/icons-material/Add'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import RemoveIcon from '@mui/icons-material/Remove'
import ZoomIn from '@mui/icons-material/ZoomIn'
import ZoomOut from '@mui/icons-material/ZoomOut'
import { IconButton, Paper, Tooltip, alpha } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '../index.ts'

const useStyles = makeStyles()(theme => ({
  background: {
    position: 'absolute',
    right: 0,
    background: theme.palette.background.paper,

    // needed when sticky header is off in lgv, e.g. in breakpoint split view
    zIndex: 2,
  },
  focusedBackground: {
    background: alpha(theme.palette.secondary.light, 0.2),
  },
}))

const MiniControls = observer(function MiniControls({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const { classes } = useStyles()
  const {
    id,
    bpPerPx,
    maxBpPerPx,
    minBpPerPx,
    hideHeader,
    scalebarOnly,
  } = model
  const { focusedViewId } = getSession(model)
  return (
    <Paper className={classes.background}>
      <Paper
        className={focusedViewId === id ? classes.focusedBackground : undefined}
      >
        <Tooltip title="Open track selector">
          <IconButton
            size="small"
            onClick={() => {
              model.activateTrackSelector()
            }}
          >
            <TrackSelectorIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <CascadingMenuButton menuItems={() => model.menuItems()}>
          <MoreVertIcon fontSize="small" />
        </CascadingMenuButton>
        <Tooltip title={scalebarOnly ? 'Expand tracks' : 'Collapse to ruler'}>
          <IconButton
            size="small"
            onClick={() => {
              model.setScalebarOnly(!scalebarOnly)
            }}
          >
            {scalebarOnly ? (
              <AddIcon fontSize="small" />
            ) : (
              <RemoveIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
        {hideHeader ? (
          <>
            <IconButton
              data-testid="zoom_out"
              disabled={bpPerPx >= maxBpPerPx - 0.0001}
              onClick={() => {
                model.zoom(bpPerPx * 2)
              }}
            >
              <ZoomOut fontSize="small" />
            </IconButton>
            <IconButton
              data-testid="zoom_in"
              disabled={bpPerPx <= minBpPerPx + 0.0001}
              onClick={() => {
                model.zoom(bpPerPx / 2)
              }}
            >
              <ZoomIn fontSize="small" />
            </IconButton>
          </>
        ) : null}
      </Paper>
    </Paper>
  )
})

export default MiniControls
