import React from 'react'

import { IconButton } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

// icons
import ZoomOutIcon from '@mui/icons-material/ZoomOut'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowLeftIcon from '@mui/icons-material/ArrowLeft'
import ArrowRightIcon from '@mui/icons-material/ArrowRight'
import CropFreeIcon from '@mui/icons-material/CropFree'

import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'

import { observer } from 'mobx-react'
import { DotplotViewModel } from '../model'

const useStyles = makeStyles()({
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
  const { classes } = useStyles()
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
        <ArrowLeftIcon />
      </IconButton>

      <IconButton
        onClick={() => {
          model.hview.scroll(100)
        }}
        className={classes.iconButton}
        title="left"
        color="secondary"
      >
        <ArrowRightIcon />
      </IconButton>
      <IconButton
        onClick={() => {
          model.vview.scroll(100)
        }}
        className={classes.iconButton}
        title="left"
        color="secondary"
      >
        <ArrowDownwardIcon />
      </IconButton>
      <IconButton
        onClick={() => {
          model.vview.scroll(-100)
        }}
        className={classes.iconButton}
        title="left"
        color="secondary"
      >
        <ArrowUpwardIcon />
      </IconButton>
      <IconButton
        onClick={model.zoomOutButton}
        className={classes.iconButton}
        color="secondary"
      >
        <ZoomOutIcon />
      </IconButton>

      <IconButton
        onClick={model.zoomInButton}
        className={classes.iconButton}
        title="zoom in"
        color="secondary"
      >
        <ZoomInIcon />
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
