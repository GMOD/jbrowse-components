import { useState } from 'react'

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

function Tooltip({
  anchorEl,
  side,
  text,
}: {
  anchorEl: HTMLDivElement
  side: string
  text: string
}) {
  const { classes } = useStyles()
  return (
    <Popover
      className={classes.popover}
      classes={{ paper: classes.paper }}
      open
      anchorEl={anchorEl}
      anchorOrigin={{
        vertical: 'top',
        horizontal: side === 'left' ? 'right' : 'left',
      }}
      transformOrigin={{
        vertical: 'bottom',
        horizontal: side === 'left' ? 'left' : 'right',
      }}
      keepMounted
      disableRestoreFocus
    >
      <Typography>{text}</Typography>
    </Popover>
  )
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
  const { classes } = useStyles()
  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null)
  return (
    <>
      {anchorEl ? (
        <>
          <Tooltip
            side="left"
            anchorEl={anchorEl}
            text={stringify(leftBpOffset)}
          />
          <Tooltip
            side="right"
            anchorEl={anchorEl}
            text={stringify(rightBpOffset)}
          />
        </>
      ) : null}
      <div
        ref={el => {
          setAnchorEl(el)
        }}
        className={classes.rubberband}
        style={{ left, width }}
      >
        {numOfBpSelected ? (
          <Typography variant="h6" className={classes.rubberbandText}>
            {toLocale(numOfBpSelected)} bp
          </Typography>
        ) : null}
      </div>
    </>
  )
}
