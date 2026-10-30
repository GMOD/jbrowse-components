import { paintMarkBlocks } from '@jbrowse/render-core/marks'

import { BASIC_FEATURE_MARKS } from '../marks/basicFeatureMarks.ts'
import { labelColors } from './labelColors.ts'
import { forEachDisplayLabel, labelCullBand } from './labelPositioning.ts'
import { paintLabels } from './paintLabels.ts'
import { resolveMapColors } from './resolveRegionColors.ts'

import type { FieldPalette } from '../../RenderFeatureDataRPC/colorClasses.ts'
import type { FeatureDataResult } from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { RegionWithData } from './labelPositioning.ts'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

export interface FeatureBandPaint {
  canvasWidth: number
  bandHeight: number
  // The label kinds the fit ladder kept, never the ones the mode asked for.
  showLabels: boolean
  showDescriptions: boolean
  fontSize: number
  // The palette rather than resolved colors, so glyphs and labels cannot be
  // handed different themes.
  palette: JBrowsePalette
  fieldPalette?: FieldPalette
}

/**
 * A laid-out feature stack painted into a band of another display: glyphs,
 * then labels, culled to the band. The screen and the SVG export both call it,
 * so the two cannot letter one stack differently.
 */
export function paintFeatureBand(
  ctx: Ctx2D,
  dataMap: ReadonlyMap<number, FeatureDataResult>,
  blocks: RenderBlock[],
  regions: RegionWithData[],
  {
    canvasWidth,
    bandHeight,
    showLabels,
    showDescriptions,
    fontSize,
    palette,
    fieldPalette,
  }: FeatureBandPaint,
) {
  paintMarkBlocks(
    ctx,
    BASIC_FEATURE_MARKS,
    resolveMapColors(dataMap, palette, fieldPalette),
    blocks,
    { scrollY: 0, canvasWidth, canvasHeight: bandHeight, outlineColor: 0 },
  )
  forEachDisplayLabel(
    regions,
    dataMap,
    {
      showLabels,
      showDescriptions,
      showSubfeatureLabels: false,
      fontSize,
      colors: labelColors(palette),
    },
    (_, labels) => {
      paintLabels(ctx, labels, fontSize)
    },
    labelCullBand(0, bandHeight),
  )
}
