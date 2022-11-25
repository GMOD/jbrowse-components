import React, { useRef } from 'react'
import { makeStyles } from 'tss-react/mui'

import { Popover, Typography, alpha } from '@mui/material'
import { stringify } from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => {
  const { primary, tertiary } = theme.palette
  const background = tertiary
    ? alpha(tertiary.main, 0.7)
    : alpha(primary.main, 0.7)
  return {
    rubberband: {
      height: '100%',
      background,
      position: 'absolute',
      zIndex: 10,
      textAlign: 'center',
      overflow: 'hidden',
    },
    rubberbandControl: {
      cursor: 'crosshair',
      width: '100%',
      minHeight: 8,
    },
    rubberbandText: {
      color: tertiary ? tertiary.contrastText : primary.contrastText,
    },
    popover: {
      mouseEvents: 'none',
      cursor: 'crosshair',
    },
    paper: {
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(1),
    },
  }
})

interface Offset {
  coord: number
  refName?: string
  oob?: boolean
}

function RubberbandSpan({
  leftBpOffset,
  rightBpOffset,
  numOfBpSelected,
  left,
  width,
}: {
  leftBpOffset: Offset
  rightBpOffset: Offset
  numOfBpSelected: number
  left: number
  width: number
}) {
  const rubberbandRef = useRef(null)
  const { classes } = useStyles()
  console.log({ leftBpOffset })
  return (
    <>
      <Popover
        className={classes.popover}
        classes={{
          paper: classes.paper,
        }}
        open
        anchorEl={rubberbandRef.current}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        keepMounted
        disableRestoreFocus
      >
        <Typography>{stringify(leftBpOffset)}</Typography>
      </Popover>
      <Popover
        className={classes.popover}
        classes={{
          paper: classes.paper,
        }}
        open
        anchorEl={rubberbandRef.current}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        keepMounted
        disableRestoreFocus
      >
        <Typography>{stringify(rightBpOffset)}</Typography>
      </Popover>
      <div
        ref={rubberbandRef}
        className={classes.rubberband}
        style={{ left, width }}
      >
        <Typography variant="h6" className={classes.rubberbandText}>
          {numOfBpSelected.toLocaleString('en-US')} bp
        </Typography>
      </div>
    </>
  )
}

export default RubberbandSpan
