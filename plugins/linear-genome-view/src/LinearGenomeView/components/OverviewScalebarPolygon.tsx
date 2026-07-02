import { getFillProps, getStrokeProps } from '@jbrowse/core/util'
import { getContentBlocksPxSpan } from '@jbrowse/core/util/Base1DUtils'
import { alpha, useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import { HEADER_BAR_HEIGHT } from '../consts.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type { ViewLayout } from '@jbrowse/core/util/Base1DUtils'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

/**
 * SVG points for a trapezoid whose top and bottom edges are horizontal, wound
 * as a single non-self-intersecting loop (bottom-left → bottom-right →
 * top-right → top-left).
 */
function trapezoidPoints({
  topLeft,
  topRight,
  bottomLeft,
  bottomRight,
  height,
}: {
  topLeft: number
  topRight: number
  bottomLeft: number
  bottomRight: number
  height: number
}) {
  return [
    [bottomLeft, height],
    [bottomRight, height],
    [topRight, 0],
    [topLeft, 0],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(' ')
}

/**
 * On-screen pixel span of the leftmost-to-rightmost content in `layout`.
 * getContentBlocksPxSpan measures from the layout's own origin, so subtracting
 * layout.offsetPx yields on-screen pixels (the overview layout has offsetPx=0
 * and is unaffected; the scrolled main view is shifted by its offset).
 */
function contentBlocksScreenSpan(
  layout: ViewLayout,
  contentBlocks: ContentBlock[],
) {
  const span = getContentBlocksPxSpan(layout, contentBlocks)
  return span
    ? {
        leftPx: span.leftPx - layout.offsetPx,
        rightPx: span.rightPx - layout.offsetPx,
      }
    : undefined
}

/**
 * The "you are here" connector: a trapezoid joining the visible content's span
 * in the overview (top edge) to that same content's span in the main view
 * (bottom edge). Both edges are projections of the same content blocks, so the
 * two ends always describe the same genomic extent.
 *
 * @param overviewOffsetPx - pixels the overview is shifted right of the main
 * view's origin. In the interactive view the overview clears the chromosome-
 * name gap (cytobandOffset); in SVG export it is flush (0).
 */
const OverviewScalebarPolygon = observer(function OverviewScalebarPolygon({
  model,
  overview,
  overviewOffsetPx = 0,
}: {
  model: LinearGenomeViewModel
  overview: ViewLayout
  overviewOffsetPx?: number
}) {
  const theme = useTheme()
  const polygonColor = theme.palette.tertiary.light
  const { contentBlocks } = model.dynamicBlocks
  const top = contentBlocksScreenSpan(overview, contentBlocks)
  const bottom = contentBlocksScreenSpan(model, contentBlocks)
  if (!top || !bottom) {
    return null
  }

  const points = trapezoidPoints({
    topLeft: top.leftPx + overviewOffsetPx,
    topRight: top.rightPx + overviewOffsetPx,
    bottomLeft: bottom.leftPx,
    bottomRight: bottom.rightPx,
    height: HEADER_BAR_HEIGHT,
  })

  return (
    <polygon
      points={points}
      {...getFillProps(alpha(polygonColor, 0.3))}
      {...getStrokeProps(alpha(polygonColor, 0.8))}
    />
  )
})

export default OverviewScalebarPolygon
