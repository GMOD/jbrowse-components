import { useState } from 'react'

import { getBpDisplayStr, stringify } from '@jbrowse/core/util'
import RubberbandTooltip from '@jbrowse/plugin-linear-genome-view/src/LinearGenomeView/components/RubberbandTooltip'
import { Typography, alpha } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

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
    rubberbandControl: {
      cursor: 'crosshair',
      width: '100%',
      minHeight: 8,
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
              <div key={`JSON.stringify(l)-${idx}`}>{stringify(l, true)}</div>
            ))}
          />
          <RubberbandTooltip
            side="right"
            anchorEl={anchorEl}
            text={rightBpOffset.map((l, idx) => (
              <div key={`JSON.stringify(l)-${idx}`}>{stringify(l, true)}</div>
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
              // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
              <div key={i}>{getBpDisplayStr(n)}</div>
            ))}
          </Typography>
        ) : null}
      </div>
    </>
  )
}
