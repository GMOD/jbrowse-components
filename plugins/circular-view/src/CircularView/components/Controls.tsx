import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { IconButton } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import JBrowseMenu from '@jbrowse/core/ui/Menu'

// icons
import ZoomOutIcon from '@mui/icons-material/ZoomOut'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import RotateLeftIcon from '@mui/icons-material/RotateLeft'
import RotateRightIcon from '@mui/icons-material/RotateRight'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import LockIcon from '@mui/icons-material/Lock'
import PhotoCamera from '@mui/icons-material/PhotoCamera'
import MoreVert from '@mui/icons-material/MoreVert'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'

// locals
import { CircularViewModel } from '../models/model'
import { getSession } from '@jbrowse/core/util'
import ExportSvgDlg from './ExportSvgDialog'

const useStyles = makeStyles()(theme => ({
  controls: {
    position: 'absolute',
    borderRight: `1px solid ${theme.palette.divider}`,
    borderBottom: `1px solid ${theme.palette.divider}`,
    left: 0,
    top: 0,
  },
}))

const Controls = observer(function ({ model }: { model: CircularViewModel }) {
  const { classes } = useStyles()
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  return (
    <div className={classes.controls}>
      <IconButton
        onClick={model.zoomOutButton}
        title={model.lockedFitToWindow ? 'unlock to zoom out' : 'zoom out'}
        disabled={model.atMaxBpPerPx || model.lockedFitToWindow}
      >
        <ZoomOutIcon />
      </IconButton>

      <IconButton
        onClick={model.zoomInButton}
        disabled={model.atMinBpPerPx}
        title="zoom in"
      >
        <ZoomInIcon />
      </IconButton>

      <IconButton
        onClick={model.rotateCounterClockwiseButton}
        title="rotate counter-clockwise"
      >
        <RotateLeftIcon />
      </IconButton>

      <IconButton
        onClick={model.rotateClockwiseButton}
        title="rotate clockwise"
      >
        <RotateRightIcon />
      </IconButton>

      <IconButton
        onClick={model.toggleFitToWindowLock}
        title={
          model.lockedFitToWindow
            ? 'locked model to window size'
            : 'unlocked model to zoom further'
        }
        disabled={model.tooSmallToLock}
      >
        {model.lockedFitToWindow ? <LockIcon /> : <LockOpenIcon />}
      </IconButton>

      <IconButton onClick={event => setAnchorEl(event.currentTarget)}>
        <MoreVert />
      </IconButton>

      {model.hideTrackSelectorButton ? null : (
        <IconButton
          onClick={model.activateTrackSelector}
          title="Open track selector"
          data-testid="circular_track_select"
        >
          <TrackSelectorIcon />
        </IconButton>
      )}

      {anchorEl ? (
        <JBrowseMenu
          anchorEl={anchorEl}
          menuItems={[
            {
              label: 'Export SVG',
              icon: PhotoCamera,
              onClick: () => {
                getSession(model).queueDialog(handleClose => [
                  ExportSvgDlg,
                  { model, handleClose },
                ])
              },
            },
          ]}
          onMenuItemClick={(_event, callback) => {
            callback()
            setAnchorEl(null)
          }}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
        />
      ) : null}
    </div>
  )
})

export default Controls
