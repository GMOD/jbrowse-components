import React from 'react'

import { IconButton, Typography, makeStyles } from '@material-ui/core'

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
  bp: {
    display: 'flex',
    alignItems: 'center',
    marginLeft: 10,
  },
  spacer: {
    flexGrow: 1,
  },
  headerBar: {
    display: 'flex',
  },
})

const DotplotControls = observer(({ model }: { model: DotplotViewModel }) => {
  const classes = useStyles()
  return (
    <div>
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

function px(bpPerPx: number, width: number) {
  return Math.round(bpPerPx * width).toLocaleString('en-US')
}

const Header = observer(
  ({
    model,
    selection,
  }: {
    model: DotplotViewModel
    selection?: { width: number; height: number }
  }) => {
    const classes = useStyles()
    return (
      <div className={classes.headerBar}>
        <DotplotControls model={model} />
        <Typography
          className={classes.bp}
          variant="body2"
          color="textSecondary"
        >
          x: {model.hview.assemblyNames.join(',')}{' '}
          {Math.round(model.hview.totalBp).toLocaleString('en-US')}bp y:{' '}
          {model.vview.assemblyNames.join(',')}{' '}
          {Math.round(model.vview.totalBp).toLocaleString('en-US')}bp
        </Typography>
        {selection ? (
          <Typography
            className={classes.bp}
            variant="body2"
            color="textSecondary"
          >
            {`width:${px(model.hview.bpPerPx, selection.width)}bp`}{' '}
            {`height:${px(model.vview.bpPerPx, selection.height)}bp`}
          </Typography>
        ) : null}
        <div className={classes.spacer} />
      </div>
    )
  },
)
export default Header
