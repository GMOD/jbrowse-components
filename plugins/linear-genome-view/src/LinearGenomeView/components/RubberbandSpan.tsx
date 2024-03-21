import React, { useRef } from 'react'
import { makeStyles } from 'tss-react/mui'
import { Popover, Typography, alpha } from '@mui/material'
import { stringify, toLocale } from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => {
  const { primary, tertiary } = theme.palette
  const background = tertiary
    ? alpha(tertiary.light, 0.7)
    : alpha(primary.light, 0.7)
  return {
    paper: {
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(1),
    },
    popover: {
      cursor: 'crosshair',
      mouseEvents: 'none',
    },
    rubberband: {
      background,
      height: '100%',
      overflow: 'hidden',
      position: 'absolute',
      textAlign: 'center',
      zIndex: 10,
    },
    rubberbandControl: {
      cursor: 'crosshair',
      minHeight: 8,
      width: '100%',
    },
    rubberbandText: {
      color: tertiary ? tertiary.contrastText : primary.contrastText,
    },
  }
})

interface Offset {
  coord: number
  refName?: string
  oob?: boolean
}

export default function RubberbandSpan({
  leftBpOffset,
  rightBpOffset,
  numOfBpSelected,
  left,
  width,
}: {
  leftBpOffset: Offset
  rightBpOffset: Offset
  numOfBpSelected?: number
  left: number
  width: number
}) {
  const ref = useRef(null)
  const { classes } = useStyles()
  return (
    <>
      {ref.current ? (
        <>
          <Popover
            className={classes.popover}
            classes={{ paper: classes.paper }}
            open
            anchorEl={ref.current}
            anchorOrigin={{ horizontal: 'left', vertical: 'top' }}
            transformOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            keepMounted
            disableRestoreFocus
          >
            <Typography>{stringify(leftBpOffset)}</Typography>
          </Popover>
          <Popover
            className={classes.popover}
            classes={{ paper: classes.paper }}
            open
            anchorEl={ref.current}
            anchorOrigin={{ horizontal: 'right', vertical: 'top' }}
            transformOrigin={{ horizontal: 'left', vertical: 'bottom' }}
            keepMounted
            disableRestoreFocus
          >
            <Typography>{stringify(rightBpOffset)}</Typography>
          </Popover>
        </>
      ) : null}
      <div ref={ref} className={classes.rubberband} style={{ left, width }}>
        {numOfBpSelected ? (
          <Typography variant="h6" className={classes.rubberbandText}>
            {toLocale(numOfBpSelected)} bp
          </Typography>
        ) : null}
      </div>
    </>
  )
}
