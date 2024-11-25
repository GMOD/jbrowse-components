import React from 'react'
import { getBpDisplayStr, stripAlpha } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import type { LinearGenomeViewModel } from '..'

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
  const c = stripAlpha(theme.palette.text.secondary)
  const x = x0 + (x1 - x0) / 2
  const y = fontSize
  return (
    <>
      <line x1={x0} x2={x1} y1={10} y2={10} stroke={c} />
      <line x1={x0} x2={x0} y1={5} y2={15} stroke={c} />
      <line x1={x1} x2={x1} y1={5} y2={15} stroke={c} />
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="hanging"
        fontSize={fontSize}
        fill={c}
      >
        {displayBp}
      </text>
    </>
  )
}
