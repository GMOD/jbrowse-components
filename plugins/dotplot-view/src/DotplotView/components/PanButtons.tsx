import React from 'react'

// icons
import ArrowDropDown from '@mui/icons-material/ArrowDropDown'
import ArrowDropUp from '@mui/icons-material/ArrowDropUp'
import ArrowLeft from '@mui/icons-material/ArrowLeft'
import ArrowRight from '@mui/icons-material/ArrowRight'
import ZoomIn from '@mui/icons-material/ZoomIn'
import ZoomOut from '@mui/icons-material/ZoomOut'
import { IconButton, Paper } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import type { DotplotViewModel } from '../model'

const useStyles = makeStyles()({
  dpad: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    margin: 0,
    position: 'absolute',
    right: 50,
    zIndex: 1000,
    top: 50,
  },
  icon: {
    padding: 0,
    margin: 0,
  },
})

const PanButtons = observer(function PanButtons({
  model,
}: {
  model: DotplotViewModel
}) {
  const { classes } = useStyles()
  return (
    <Paper className={classes.dpad} elevation={6}>
      <div />
      <IconButton
        className={classes.icon}
        onClick={() => {
          model.vview.scroll(100)
        }}
      >
        <ArrowDropUp />
      </IconButton>
      <div />

      <IconButton
        className={classes.icon}
        onClick={() => {
          model.hview.scroll(-100)
        }}
      >
        <ArrowLeft />
      </IconButton>
      <div />
      <IconButton
        className={classes.icon}
        onClick={() => {
          model.hview.scroll(100)
        }}
      >
        <ArrowRight />
      </IconButton>

      <div />
      <IconButton
        className={classes.icon}
        onClick={() => {
          model.vview.scroll(-100)
        }}
      >
        <ArrowDropDown />
      </IconButton>
      <div />
      <IconButton
        className={classes.icon}
        onClick={() => {
          model.zoomIn()
        }}
      >
        <ZoomIn />
      </IconButton>
      <div />
      <IconButton
        className={classes.icon}
        onClick={() => {
          model.zoomOut()
        }}
      >
        <ZoomOut />
      </IconButton>
    </Paper>
  )
})

export default PanButtons
