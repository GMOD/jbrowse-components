import { svgNodeId } from '@jbrowse/core/svg/svgId'
import { alpha } from '@jbrowse/core/ui/palette'
import { getFillProps, getStrokeProps, stripAlpha } from '@jbrowse/core/util'
import {
  regionBlocksPxExtent,
  transformPxSpan,
} from '@jbrowse/core/util/Base1DUtils'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { CLOSE_UP_FRAME_WIDTH, closeUpColor } from '../closeUps.ts'
import { HEADER_BAR_HEIGHT } from '../consts.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type { PxSpan, ViewLayout } from '@jbrowse/core/util/Base1DUtils'

/**
 * SVG points for a trapezoid with horizontal top and bottom edges, wound as a
 * single non-self-intersecting loop (bottom-left → bottom-right → top-right →
 * top-left).
 */
function trapezoidPoints(top: PxSpan, bottom: PxSpan, height: number) {
  return [
    [bottom.leftPx, height],
    [bottom.rightPx, height],
    [top.rightPx, 0],
    [top.leftPx, 0],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(' ')
}

// Fill/stroke are theme-derived and zoom-invariant, so they live in a static
// class computed once per theme (makeStyles memoizes) — an on-screen zoom frame
// then does zero color parsing. SVG export can't carry a CSS class, so that path
// serializes explicit fill/stroke attributes instead (see `exportSvg` below).
const FILL_OPACITY = 0.3
const STROKE_OPACITY = 0.8

const CLOSE_UP_FILL_TOP = 0.6
const CLOSE_UP_FILL_BOTTOM = 0.2

const useStyles = makeStyles()(theme => ({
  polygon: {
    fill: alpha(theme.palette.tertiary.light, FILL_OPACITY),
    stroke: alpha(theme.palette.tertiary.light, STROKE_OPACITY),
  },
}))

/**
 * The "you are here" connector: a trapezoid joining the visible region's extent
 * in the overview (top edge) to that same extent in the main view (bottom
 * edge). Both edges come from one pixel extent, so they always describe the
 * same regions — including elided ones.
 *
 * @param overviewOffsetPx - pixels the overview is shifted right of the main
 * view's origin. In the interactive view the overview clears the chromosome-
 * name gap (cytobandOffset); in SVG export it is flush (0).
 * @param exportSvg - serialize explicit fill/stroke attributes (the split the
 * `getFill/StrokeProps` helpers exist for) instead of the on-screen CSS class,
 * which wouldn't survive into a standalone exported SVG.
 * @param gradient - a close-up's connector: a fill fading from the narrow edge
 * to the wide one, outlined in the colour of the frame it opens into, so the
 * close-up below reads as an inset of the row above rather than a second view
 * at the same zoom.
 */
const OverviewScalebarPolygon = observer(function OverviewScalebarPolygon({
  model,
  overview,
  overviewOffsetPx = 0,
  height = HEADER_BAR_HEIGHT,
  exportSvg = false,
  gradient = false,
}: {
  model: LinearGenomeViewModel
  overview: ViewLayout
  overviewOffsetPx?: number
  height?: number
  exportSvg?: boolean
  gradient?: boolean
}) {
  const { classes, theme } = useStyles()
  const { offsetPx, bpPerPx, dynamicBlocks } = model
  const extent = regionBlocksPxExtent(dynamicBlocks.blocks)
  if (!extent) {
    return null
  }

  // the main view and overview lay out the same regions from cumulative-bp 0,
  // so a main-view pixel maps to the (more zoomed-out) overview by the bpPerPx
  // ratio; the bottom edge is the same extent in main-view space, shifted by
  // the scroll offset
  const top = transformPxSpan(
    extent,
    bpPerPx / overview.bpPerPx,
    overviewOffsetPx,
  )
  const bottom = transformPxSpan(extent, 1, -offsetPx)
  const points = trapezoidPoints(top, bottom, height)

  if (gradient) {
    const id = `close-up-connector-${svgNodeId(model)}`
    const color = stripAlpha(theme.palette.tertiary.light)
    return (
      <>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={color}
              stopOpacity={CLOSE_UP_FILL_TOP}
            />
            <stop
              offset="100%"
              stopColor={color}
              stopOpacity={CLOSE_UP_FILL_BOTTOM}
            />
          </linearGradient>
        </defs>
        <polygon
          points={points}
          fill={`url(#${id})`}
          stroke={closeUpColor(theme.palette)}
          strokeWidth={CLOSE_UP_FRAME_WIDTH}
          strokeLinejoin="round"
        />
      </>
    )
  }

  return exportSvg ? (
    <polygon
      points={points}
      {...getFillProps(alpha(theme.palette.tertiary.light, FILL_OPACITY))}
      {...getStrokeProps(alpha(theme.palette.tertiary.light, STROKE_OPACITY))}
    />
  ) : (
    <polygon points={points} className={classes.polygon} />
  )
})

export default OverviewScalebarPolygon
