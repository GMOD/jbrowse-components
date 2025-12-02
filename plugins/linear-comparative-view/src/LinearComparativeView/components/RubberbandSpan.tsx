import { useState } from 'react'

import { getBpDisplayStr, stringify } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Typography, alpha } from '@mui/material'

import RubberbandTooltip from './RubberbandTooltip'

const useStyles = makeStyles()(theme => {
  const { tertiary } = theme.palette
  const background = alpha(tertiary.light, 0.7)
  return {
    rubberband: {
      height: '100%',
      background,
      position: 'absolute',
      zIndex: 830,
      textAlign: 'center',
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
  leftBpOffset: Offset[]
  rightBpOffset: Offset[]
  numOfBpSelected?: number[]
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
            text={leftBpOffset.map((l, idx) => (
              <div key={`${JSON.stringify(l)}-left-${idx}`}>
                {stringify(l, true)}
              </div>
            ))}
          />
          <RubberbandTooltip
            side="right"
            anchorEl={anchorEl}
            text={rightBpOffset.map((l, idx) => (
              <div key={`${JSON.stringify(l)}-right-${idx}`}>
                {stringify(l, true)}
              </div>
            ))}
          />
        </>
      ) : null}
      <div className={classes.rubberband} style={{ left, width }}>
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
            {numOfBpSelected.map((n, i) => (
              <div key={`bpSelectedRow-${i}`}>{getBpDisplayStr(n)}</div>
            ))}
          </Typography>
        ) : null}
      </div>
    </>
  )
}
