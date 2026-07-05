import { getBpDisplayStr, getFillProps, getStrokeProps } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'

import type { LinearGenomeViewModel } from '../index.ts'

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
  const strokeProps = getStrokeProps(theme.palette.text.secondary)
  const fillProps = getFillProps(theme.palette.text.secondary)
  return (
    <>
      <line x1={x0} x2={x1} y1={10} y2={10} {...strokeProps} />
      <line x1={x0} x2={x0} y1={5} y2={15} {...strokeProps} />
      <line x1={x1} x2={x1} y1={5} y2={15} {...strokeProps} />
      <text
        x={(x0 + x1) / 2}
        y={fontSize}
        textAnchor="middle"
        dominantBaseline="hanging"
        fontSize={fontSize}
        {...fillProps}
      >
        {displayBp}
      </text>
    </>
  )
}
