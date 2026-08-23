import {
  LITERAL,
  resolveColorLane,
  themedColorTable,
} from '../../RenderFeatureDataRPC/colorClasses.ts'

import type { FeatureDataResult } from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'

/**
 * Fill in the colors the worker could not: it has no palette, so a CDS painted
 * by reading frame, a connector taking the unset `connectorColor` default and a
 * theme-derived outline all ship as classes with a zero in their color lane
 * (see colorClasses.ts). This is the `encode` half of the per-region lifecycle,
 * and it is what makes a light/dark toggle re-encode the loaded regions instead
 * of refetching them.
 *
 * Returns the region unchanged — by reference — when nothing in it is themed,
 * which is the common case (no `colorByCDS`, an explicit `connectorColor`, no
 * outline). The upload diff is by reference, so an unthemed track pays nothing
 * for this pass beyond the walk.
 */
export function resolveRegionColors(
  data: FeatureDataResult,
  colorTable: Uint32Array,
) {
  const rectColors = resolveColorLane(
    data.rectColors,
    data.rectColorClasses,
    colorTable,
  )
  const lineColors = resolveColorLane(
    data.lineColors,
    data.lineColorClasses,
    colorTable,
  )
  const arrowColors = resolveColorLane(
    data.arrowColors,
    data.arrowColorClasses,
    colorTable,
  )
  const outlineColor =
    data.outlineColorClass === LITERAL
      ? data.outlineColor
      : colorTable[data.outlineColorClass]!
  return rectColors === data.rectColors &&
    lineColors === data.lineColors &&
    arrowColors === data.arrowColors &&
    outlineColor === data.outlineColor
    ? data
    : { ...data, rectColors, lineColors, arrowColors, outlineColor }
}

/**
 * The same resolution over a whole map, for the two consumers that draw
 * straight from the laid-out data rather than through the upload lifecycle: the
 * SVG export (which resolves the EXPORT theme's palette, so a figure rendered
 * for the other mode comes out in its colors) and `paintFeatureBand`.
 */
export function resolveMapColors(
  map: ReadonlyMap<number, FeatureDataResult>,
  palette: JBrowsePalette,
) {
  const colorTable = themedColorTable(palette)
  const out = new Map<number, FeatureDataResult>()
  for (const [idx, data] of map) {
    out.set(idx, resolveRegionColors(data, colorTable))
  }
  return out
}
