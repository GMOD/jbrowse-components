import {
  LITERAL,
  resolveColorLane,
  themedColorTable,
} from '../../RenderFeatureDataRPC/colorClasses.ts'

import type { FeatureDataResult } from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'

/**
 * The worker has no palette, so it ships themed colors as classes with a zero
 * color lane and the main thread fills them in — which is what lets a light/dark
 * toggle re-encode the loaded regions instead of refetching them. An unthemed
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
