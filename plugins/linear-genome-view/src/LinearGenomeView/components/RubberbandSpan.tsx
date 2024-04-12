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
    rubberband: {
      height: '100%',
      background,
      position: 'absolute',
      zIndex: 4,
      textAlign: 'center',
    },
    rubberbandControl: {
      cursor: 'crosshair',
      width: '100%',
      minHeight: 8,
    },
    rubberbandText: {
      color: tertiary ? tertiary.contrastText : primary.contrastText,
      position: 'sticky',
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

export default function RubberbandSpan({
  leftBpOffset,
  rightBpOffset,
  numOfBpSelected,
  left,
  width,
  top = 0,
}: {
  leftBpOffset: Offset
  rightBpOffset: Offset
  numOfBpSelected?: number
  left: number
  width: number
  top?: number
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
            anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
            transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
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
            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            keepMounted
            disableRestoreFocus
          >
            <Typography>{stringify(rightBpOffset)}</Typography>
          </Popover>
        </>
      ) : null}
      <div className={classes.rubberband} style={{ left, width }}>
        {numOfBpSelected ? (
          <Typography
            ref={ref}
            variant="h6"
            className={classes.rubberbandText}
            style={{ top }}
          >
            {toLocale(numOfBpSelected)} bp
          </Typography>
        ) : null}
      </div>
    </>
  )
}
