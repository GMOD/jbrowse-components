import { getFillProps, getStrokeProps } from '@jbrowse/core/util'
import { getContentBlocksPxSpan } from '@jbrowse/core/util/Base1DUtils'
import { alpha, useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import { HEADER_BAR_HEIGHT } from '../consts.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type { ViewLayout } from '@jbrowse/core/util/Base1DUtils'

const OverviewScalebarPolygon = observer(function OverviewScalebarPolygon({
  model,
  overview,
  useOffset = true,
}: {
  model: LinearGenomeViewModel
  overview: ViewLayout
  useOffset?: boolean
}) {
  const theme = useTheme()
  const polygonColor = theme.palette.tertiary.light
  const { offsetPx, dynamicBlocks, cytobandOffset } = model
  const { contentBlocks, totalWidthPxWithoutBorders } = dynamicBlocks
  const span = getContentBlocksPxSpan(overview, contentBlocks)
  if (!span) {
    return null
  }

  const offset = useOffset ? cytobandOffset : 0
  const topLeft = span.leftPx + offset
  const topRight = span.rightPx + offset
  const startPx = Math.max(0, -offsetPx)
  const endPx = startPx + totalWidthPxWithoutBorders

  const points = [
    [startPx, HEADER_BAR_HEIGHT],
    [endPx, HEADER_BAR_HEIGHT],
    [topRight, 0],
    [topLeft, 0],
  ]

  return (
    <polygon
      points={points.toString()}
      {...getFillProps(alpha(polygonColor, 0.3))}
      {...getStrokeProps(alpha(polygonColor, 0.8))}
    />
  )
})

export default OverviewScalebarPolygon
