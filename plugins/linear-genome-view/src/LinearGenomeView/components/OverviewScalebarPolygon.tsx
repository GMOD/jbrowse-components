import { useEffect, useRef } from 'react'

import { getFillProps, getStrokeProps } from '@jbrowse/core/util'
import { alpha, useTheme } from '@mui/material'
import { autorun } from 'mobx'

import { HEADER_BAR_HEIGHT } from '../consts'

import type { LinearGenomeViewModel } from '..'
import type { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'

function OverviewScalebarPolygon({
  model,
  overview,
  useOffset = true,
}: {
  model: LinearGenomeViewModel
  overview: Base1DViewModel
  useOffset?: boolean
}) {
  const theme = useTheme()
  const polygonRef = useRef<SVGPolygonElement>(null)
  const polygonColor = theme.palette.tertiary.light
  const multiplier = Number(useOffset)

  useEffect(() => {
    return autorun(() => {
      const {
        interRegionPaddingWidth,
        offsetPx,
        dynamicBlocks,
        cytobandOffset,
      } = model
      const { contentBlocks, totalWidthPxWithoutBorders } = dynamicBlocks
      const polygon = polygonRef.current
      if (!polygon || !contentBlocks.length) {
        return
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
      polygon.setAttribute('points', points.toString())
    })
  }, [model, overview, multiplier])

  return (
    <polygon
      ref={polygonRef}
      {...getFillProps(alpha(polygonColor, 0.3))}
      {...getStrokeProps(alpha(polygonColor, 0.8))}
    />
  )
}

export default OverviewScalebarPolygon
