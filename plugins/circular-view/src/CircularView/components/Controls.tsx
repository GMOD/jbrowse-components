import React, { useState } from 'react'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import JBrowseMenu from '@jbrowse/core/ui/Menu'
import { getSession } from '@jbrowse/core/util'
import LockIcon from '@mui/icons-material/Lock'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import MoreVert from '@mui/icons-material/MoreVert'
import PhotoCamera from '@mui/icons-material/PhotoCamera'
import RotateLeftIcon from '@mui/icons-material/RotateLeft'
import RotateRightIcon from '@mui/icons-material/RotateRight'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import ZoomOutIcon from '@mui/icons-material/ZoomOut'
import { IconButton } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// icons

// locals
import ExportSvgDialog from './ExportSvgDialog'
import type { CircularViewModel } from '../models/model'

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

      <IconButton
        onClick={event => {
          setAnchorEl(event.currentTarget)
        }}
      >
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
                  ExportSvgDialog,
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
          onClose={() => {
            setAnchorEl(null)
          }}
        />
      ) : null}
    </div>
  )
})

export default Controls
