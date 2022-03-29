import React from 'react'

import { IconButton, makeStyles } from '@material-ui/core'

// icons
import ZoomOut from '@material-ui/icons/ZoomOut'
import ZoomIn from '@material-ui/icons/ZoomIn'
import ArrowUp from '@material-ui/icons/KeyboardArrowUp'
import ArrowDown from '@material-ui/icons/KeyboardArrowDown'
import ArrowLeft from '@material-ui/icons/KeyboardArrowLeft'
import ArrowRight from '@material-ui/icons/KeyboardArrowRight'
import CropFreeIcon from '@material-ui/icons/CropFree'

import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'

import { observer } from 'mobx-react'
import { DotplotViewModel } from '../model'

const useStyles = makeStyles({
  iconButton: {
    margin: 5,
  },
  controls: {
    overflow: 'hidden',
    display: 'flex',
    background: 'white',
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    border: '1px solid #a2a2a2',
  },
})

const DotplotControls = observer(({ model }: { model: DotplotViewModel }) => {
  const classes = useStyles()
  return (
    <div className={classes.controls}>
      <IconButton
        onClick={() => {
          model.hview.scroll(-100)
        }}
        className={classes.iconButton}
        title="left"
        color="secondary"
      >
        <ArrowLeft />
      </IconButton>

      <IconButton
        onClick={() => {
          model.hview.scroll(100)
        }}
        className={classes.iconButton}
        title="left"
        color="secondary"
      >
        <ArrowRight />
      </IconButton>
      <IconButton
        onClick={() => {
          model.vview.scroll(100)
        }}
        className={classes.iconButton}
        title="left"
        color="secondary"
      >
        <ArrowDown />
      </IconButton>
      <IconButton
        onClick={() => {
          model.vview.scroll(-100)
        }}
        className={classes.iconButton}
        title="left"
        color="secondary"
      >
        <ArrowUp />
      </IconButton>
      <IconButton
        onClick={model.zoomOutButton}
        className={classes.iconButton}
        color="secondary"
      >
        <ZoomOut />
      </IconButton>

      <IconButton
        onClick={model.zoomInButton}
        className={classes.iconButton}
        title="zoom in"
        color="secondary"
      >
        <ZoomIn />
      </IconButton>

      <IconButton
        onClick={model.activateTrackSelector}
        className={classes.iconButton}
        title="Open track selector"
        data-testid="circular_track_select"
        color="secondary"
      >
        <TrackSelectorIcon />
      </IconButton>

      <IconButton
        onClick={model.squareView}
        className={classes.iconButton}
        title="Square view"
        color="secondary"
      >
        <CropFreeIcon />
      </IconButton>
    </div>
  )
})

export default DotplotControls
