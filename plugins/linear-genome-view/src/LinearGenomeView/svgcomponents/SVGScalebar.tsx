import React from 'react'
import { getBpDisplayStr } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { LinearGenomeViewModel } from '..'

type LGV = LinearGenomeViewModel

export default function SVGScalebar({
  model,
  fontSize,
}: {
  model: LGV
  fontSize: number
}) {
  const {
    offsetPx,
    dynamicBlocks: { totalWidthPxWithoutBorders: totalWidthPx, totalBp },
  } = model
  const theme = useTheme()
  const displayBp = getBpDisplayStr(totalBp)
  const x0 = Math.max(-offsetPx, 0)
  const x1 = x0 + totalWidthPx
  return (
    <>
      <line
        x1={x0}
        x2={x1}
        y1={10}
        y2={10}
        stroke={theme.palette.text.secondary}
      />
      <line
        x1={x0}
        x2={x0}
        y1={5}
        y2={15}
        stroke={theme.palette.text.secondary}
      />
      <line
        x1={x1}
        x2={x1}
        y1={5}
        y2={15}
        stroke={theme.palette.text.secondary}
      />
      <text
        x={x0 + (x1 - x0) / 2}
        y={fontSize * 2}
        textAnchor="middle"
        fontSize={fontSize}
        fill={theme.palette.text.primary}
      >
        {displayBp}
      </text>
    </>
  )
}
