import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import {
  OUTLINE,
  resolveColorLane,
  themedColorTable,
} from '../../RenderFeatureDataRPC/colorClasses.ts'
import { THEME_DERIVED_COLOR } from '../../RenderFeatureDataRPC/renderConfig.ts'

import type { FeatureDataResult } from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'

/**
 * The worker has no palette, so it ships themed colors as classes with a zero
 * color lane and the main thread fills them in, so a light/dark toggle
 * re-encodes the loaded regions without refetching them. An unthemed
 * region comes back by reference, because the upload diff compares by reference.
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
  return rectColors === data.rectColors &&
    lineColors === data.lineColors &&
    arrowColors === data.arrowColors
    ? data
    : { ...data, rectColors, lineColors, arrowColors }
}

/**
 * The packed outline color the `outlineColor` slot asks for: 0 for none, the
 * palette's faint outline for the menu toggle's `THEME_DERIVED_COLOR` (a fixed
 * black vanishes on a dark track), else the literal. Display-wide, so it rides
 * in the render state rather than in each region's payload.
 */
export function resolveOutlineColor(slot: string, palette: JBrowsePalette) {
  return slot === THEME_DERIVED_COLOR
    ? themedColorTable(palette)[OUTLINE]!
    : slot
      ? cssColorToABGR(slot)
      : 0
}

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
