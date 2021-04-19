import React from 'react'

import { makeStyles } from '@material-ui/core/styles'
import ZoomOut from '@material-ui/icons/ZoomOut'
import ZoomIn from '@material-ui/icons/ZoomIn'
import ArrowUp from '@material-ui/icons/KeyboardArrowUp'
import ArrowDown from '@material-ui/icons/KeyboardArrowDown'
import ArrowLeft from '@material-ui/icons/KeyboardArrowLeft'
import ArrowRight from '@material-ui/icons/KeyboardArrowRight'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import IconButton from '@material-ui/core/IconButton'

import { observer } from 'mobx-react'
import { DotplotViewModel } from '../model'

const useStyles = makeStyles({
  iconButton: {
    padding: '4px',
    margin: '0 2px 0 2px',
  },
  controls: {
    overflow: 'hidden',
    background: 'white',
    whiteSpace: 'nowrap',
    position: 'absolute',
    boxSizing: 'border-box',
    border: '1px solid #a2a2a2',
    right: 0,
    top: 0,
    zIndex: 1001, // needs to be above overlay but below things that might naturally go on top of it like a context menu from jbrowse-core/ui
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
        title="Open track selector"
        value="track_select"
        data-testid="circular_track_select"
        color="secondary"
      >
        <TrackSelectorIcon />
      </IconButton>
    </div>
  )
})

export default DotplotControls
