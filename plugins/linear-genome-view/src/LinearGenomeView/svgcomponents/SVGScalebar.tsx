import {
  getBpDisplayStr,
  getFillProps,
  getStrokeProps,
} from '@jbrowse/core/util'
import { useTheme } from '@mui/material'

import { SVG_SCALEBAR_CAP } from '../consts.ts'

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
  // the bar is drawn on this component's own origin (y=0), with capped ends and
  // the bp label hanging just below; callers translate it to the desired line y
  return (
    <>
      <line x1={x0} x2={x1} y1={0} y2={0} {...strokeProps} />
      <line
        x1={x0}
        x2={x0}
        y1={-SVG_SCALEBAR_CAP}
        y2={SVG_SCALEBAR_CAP}
        {...strokeProps}
      />
      <line
        x1={x1}
        x2={x1}
        y1={-SVG_SCALEBAR_CAP}
        y2={SVG_SCALEBAR_CAP}
        {...strokeProps}
      />
      <text
        x={(x0 + x1) / 2}
        y={SVG_SCALEBAR_CAP}
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
