import React from 'react'
import { getFillProps, getStrokeProps } from '@jbrowse/core/util'
import { useTheme, alpha } from '@mui/material'
import { observer } from 'mobx-react'

// core

// locals
import { HEADER_BAR_HEIGHT } from '../consts'
import type { LinearGenomeViewModel } from '..'
import type { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'

const OverviewScalebarPolygon = observer(function ({
  model,
  overview,
  useOffset = true,
}: {
  model: LinearGenomeViewModel
  overview: Base1DViewModel
  useOffset?: boolean
}) {
  const theme = useTheme()
  const multiplier = Number(useOffset)
  const { interRegionPaddingWidth, offsetPx, dynamicBlocks, cytobandOffset } =
    model
  const { contentBlocks, totalWidthPxWithoutBorders } = dynamicBlocks
  const polygonColor = theme.palette.tertiary.light

  // catches possible null from at's below
  if (!contentBlocks.length) {
    return null
  }
  const first = contentBlocks.at(0)!
  const last = contentBlocks.at(-1)!
  const topLeft =
    (overview.bpToPx({
      ...first,
      coord: first.reversed ? first.end : first.start,
    }) || 0) +
    cytobandOffset * multiplier
  const topRight =
    (overview.bpToPx({
      ...last,
      coord: last.reversed ? last.start : last.end,
    }) || 0) +
    cytobandOffset * multiplier

  const startPx = Math.max(0, -offsetPx)
  const endPx =
    startPx +
    totalWidthPxWithoutBorders +
    (contentBlocks.length * interRegionPaddingWidth) / 2

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
