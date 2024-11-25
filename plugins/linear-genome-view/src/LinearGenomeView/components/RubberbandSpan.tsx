import React, { useRef } from 'react'
import { stringify, toLocale } from '@jbrowse/core/util'
import { Popover, Typography, alpha } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()(theme => {
  const { tertiary } = theme.palette
  const background = alpha(tertiary.light, 0.7)
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
      color: tertiary.contrastText,
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
}: {
  leftBpOffset: Offset
  rightBpOffset: Offset
  numOfBpSelected?: number
  left: number
  width: number
}) {
  const ref = useRef<HTMLDivElement>(null)
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
