import { getFillProps, getStrokeProps } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { alpha } from '@mui/material'
import { observer } from 'mobx-react'

import { HEADER_BAR_HEIGHT } from '../consts.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type { ViewLayout } from '@jbrowse/core/util/Base1DUtils'
import type { BaseBlock } from '@jbrowse/core/util/blockTypes'

interface Span {
  leftPx: number
  rightPx: number
}

/** Project a span into another pixel space: each end becomes px * scale + translatePx. */
function transformSpan(span: Span, scale: number, translatePx: number): Span {
  return {
    leftPx: span.leftPx * scale + translatePx,
    rightPx: span.rightPx * scale + translatePx,
  }
}

/**
 * SVG points for a trapezoid with horizontal top and bottom edges, wound as a
 * single non-self-intersecting loop (bottom-left → bottom-right → top-right →
 * top-left).
 */
function trapezoidPoints(top: Span, bottom: Span, height: number) {
  return [
    [bottom.leftPx, height],
    [bottom.rightPx, height],
    [top.rightPx, 0],
    [top.leftPx, 0],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(' ')
}

/**
 * Absolute pixel extent (measured from the layout origin) of the region blocks
 * — content and elided — but not the blank inter-region padding at the ends.
 * Since dynamic blocks only pad at the ends, the region blocks are contiguous,
 * so the first block's left edge to the last block's right edge is the full
 * extent. Uses block pixel geometry rather than projecting genomic coordinates
 * because coalesced elided blocks have their coordinates zeroed out.
 */
function regionBlocksPxExtent(blocks: BaseBlock[]): Span | undefined {
  const regions = blocks.filter(
    b => b.type === 'ContentBlock' || b.type === 'ElidedBlock',
  )
  const first = regions.at(0)
  const last = regions.at(-1)
  return first && last
    ? { leftPx: first.offsetPx, rightPx: last.offsetPx + last.widthPx }
    : undefined
}

// Fill/stroke are theme-derived and zoom-invariant, so they live in a static
// class computed once per theme (makeStyles memoizes) — an on-screen zoom frame
// then does zero color parsing. SVG export can't carry a CSS class, so that path
// serializes explicit fill/stroke attributes instead (see `exportSvg` below).
const useStyles = makeStyles()(theme => ({
  polygon: {
    fill: alpha(theme.palette.tertiary.light, 0.3),
    stroke: alpha(theme.palette.tertiary.light, 0.8),
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
 */
const OverviewScalebarPolygon = observer(function OverviewScalebarPolygon({
  model,
  overview,
  overviewOffsetPx = 0,
  exportSvg = false,
}: {
  model: LinearGenomeViewModel
  overview: ViewLayout
  overviewOffsetPx?: number
  exportSvg?: boolean
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
  const top = transformSpan(
    extent,
    bpPerPx / overview.bpPerPx,
    overviewOffsetPx,
  )
  const bottom = transformSpan(extent, 1, -offsetPx)
  const points = trapezoidPoints(top, bottom, HEADER_BAR_HEIGHT)

  return exportSvg ? (
    <polygon
      points={points}
      {...getFillProps(alpha(theme.palette.tertiary.light, 0.3))}
      {...getStrokeProps(alpha(theme.palette.tertiary.light, 0.8))}
    />
  ) : (
    <polygon points={points} className={classes.polygon} />
  )
})

export default OverviewScalebarPolygon
