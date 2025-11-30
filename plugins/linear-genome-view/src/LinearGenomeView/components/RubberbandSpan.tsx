import { useState } from 'react'

import { getBpDisplayStr, stringify } from '@jbrowse/core/util'
import { Typography, alpha } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

import RubberbandTooltip from './RubberbandTooltip'

const useStyles = makeStyles()(theme => {
  const { tertiary } = theme.palette
  const background = alpha(tertiary.light, 0.7)
  return {
    rubberband: {
      height: '100%',
      background,
      position: 'absolute',
      left: 0,
      zIndex: 830,
      textAlign: 'center',
      cursor: 'crosshair',
    },

    rubberbandText: {
      color: theme.palette.tertiary.contrastText,
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
  sticky = false,
}: {
  leftBpOffset: Offset
  rightBpOffset: Offset
  numOfBpSelected?: number
  left: number
  width: number
  top?: number
  sticky?: boolean
}) {
  const { classes } = useStyles()
  const [anchorEl, setAnchorEl] = useState<HTMLSpanElement | null>(null)
  return (
    <>
      {anchorEl ? (
        <>
          <RubberbandTooltip
            side="left"
            anchorEl={anchorEl}
            text={stringify(leftBpOffset)}
          />
          <RubberbandTooltip
            side="right"
            anchorEl={anchorEl}
            text={stringify(rightBpOffset)}
          />
        </>
      ) : null}
      <div
        className={classes.rubberband}
        style={{ transform: `translateX(${left}px)`, width }}
      >
        {numOfBpSelected ? (
          <Typography
            ref={el => {
              setAnchorEl(el)
            }}
            variant="h6"
            className={classes.rubberbandText}
            style={{
              top,
              position: sticky ? 'sticky' : undefined,
            }}
          >
            {getBpDisplayStr(numOfBpSelected)}
          </Typography>
        ) : null}
      </div>
    </>
  )
}
