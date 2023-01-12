import React from 'react'
import { observer } from 'mobx-react'
import IconButton from '@mui/material/IconButton'
import { makeStyles } from 'tss-react/mui'
import { grey } from '@mui/material/colors'

// icons
import ZoomOutIcon from '@mui/icons-material/ZoomOut'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import RotateLeftIcon from '@mui/icons-material/RotateLeft'
import RotateRightIcon from '@mui/icons-material/RotateRight'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import LockIcon from '@mui/icons-material/Lock'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'

// locals
import { CircularViewModel } from '../models/CircularView'

const useStyles = makeStyles()({
  iconButton: {
    padding: '4px',
    margin: '0 2px 0 2px',
  },
  controls: {
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    position: 'absolute',
    background: grey[200],
    boxSizing: 'border-box',
    borderRight: '1px solid #a2a2a2',
    borderBottom: '1px solid #a2a2a2',
    left: 0,
    top: 0,
  },
})

const Controls = observer(function ({ model }: { model: CircularViewModel }) {
  const { classes } = useStyles()
  return (
    <div className={classes.controls}>
      <IconButton
        onClick={model.zoomOutButton}
        className={classes.iconButton}
        title={model.lockedFitToWindow ? 'unlock to zoom out' : 'zoom out'}
        disabled={model.atMaxBpPerPx || model.lockedFitToWindow}
        color="secondary"
      >
        <ZoomOutIcon />
      </IconButton>

      <IconButton
        onClick={model.zoomInButton}
        className={classes.iconButton}
        title="zoom in"
        disabled={model.atMinBpPerPx}
        color="secondary"
      >
        <ZoomInIcon />
      </IconButton>

      <IconButton
        onClick={model.rotateCounterClockwiseButton}
        className={classes.iconButton}
        title="rotate counter-clockwise"
        color="secondary"
      >
        <RotateLeftIcon />
      </IconButton>

      <IconButton
        onClick={model.rotateClockwiseButton}
        className={classes.iconButton}
        title="rotate clockwise"
        color="secondary"
      >
        <RotateRightIcon />
      </IconButton>

      <IconButton
        onClick={model.toggleFitToWindowLock}
        className={classes.iconButton}
        title={
          model.lockedFitToWindow
            ? 'locked model to window size'
            : 'unlocked model to zoom further'
        }
        disabled={model.tooSmallToLock}
        color="secondary"
      >
        {model.lockedFitToWindow ? <LockIcon /> : <LockOpenIcon />}
      </IconButton>

      {model.hideTrackSelectorButton ? null : (
        <IconButton
          onClick={model.activateTrackSelector}
          title="Open track selector"
          data-testid="circular_track_select"
          color="secondary"
        >
          <TrackSelectorIcon />
        </IconButton>
      )}
    </div>
  )
})
export default Controls
