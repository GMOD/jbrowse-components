import { useState } from 'react'

import RubberbandTooltip from '@jbrowse/core/ui/RubberbandTooltip'
import { getBpDisplayStr, stringify } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Typography, alpha } from '@mui/material'

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
  // anchor the left/right bp tooltips to the full-width span itself so they
  // align to its edges and show even when there's no bp-count label inside
  // (e.g. the overview rubberband passes no numOfBpSelected)
  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null)

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
        ref={setAnchorEl}
        style={{ transform: `translateX(${left}px)`, width }}
      >
        {numOfBpSelected ? (
          <Typography
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
