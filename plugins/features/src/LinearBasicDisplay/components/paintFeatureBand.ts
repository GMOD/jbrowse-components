import { paintMarkBlocks } from '@jbrowse/render-core/marks'

import { BASIC_FEATURE_MARKS } from '../marks/basicFeatureMarks.ts'
import { labelColors } from './labelColors.ts'
import { exactCullBand, forEachDisplayLabel } from './labelPositioning.ts'
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
  // How far the stack is scrolled up the band, 0 where it does not scroll.
  scrollY: number
  // The label kinds the fit ladder kept, never the ones the mode asked for.
  showLabels: boolean
  showDescriptions: boolean
  fontSize: number
  // An export's, which the labels are drawn and measured in.
  fontFamily?: string
  // The palette rather than resolved colors, so glyphs and labels cannot be
  // handed different themes.
  palette: JBrowsePalette
  fieldPalette?: FieldPalette
}

/** A laid-out feature stack's glyphs, culled to the band. */
export function paintFeatureBandGlyphs(
  ctx: Ctx2D,
  dataMap: ReadonlyMap<number, FeatureDataResult>,
  blocks: RenderBlock[],
  { canvasWidth, bandHeight, scrollY, palette, fieldPalette }: FeatureBandPaint,
) {
  paintMarkBlocks(
    ctx,
    BASIC_FEATURE_MARKS,
    resolveMapColors(dataMap, palette, fieldPalette),
    blocks,
    { scrollY, canvasWidth, canvasHeight: bandHeight, outlineColor: 0 },
  )
}

/**
 * A laid-out feature stack's labels, culled to the band: a layer of their own
 * in an export, so they stay text over a rasterized band.
 */
export function paintFeatureBandLabels(
  ctx: Ctx2D,
  dataMap: ReadonlyMap<number, FeatureDataResult>,
  regions: RegionWithData[],
  {
    bandHeight,
    scrollY,
    showLabels,
    showDescriptions,
    fontSize,
    fontFamily,
    palette,
  }: FeatureBandPaint,
) {
  ctx.save()
  ctx.translate(0, -scrollY)
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
      paintLabels(ctx, labels, fontSize, fontFamily)
    },
    exactCullBand(scrollY, bandHeight, fontSize),
  )
  ctx.restore()
}

/**
 * A laid-out feature stack painted into a band of another display: glyphs,
 * then labels. The screen and the SVG export both paint these halves, so the
 * two cannot letter one stack differently.
 */
export function paintFeatureBand(
  ctx: Ctx2D,
  dataMap: ReadonlyMap<number, FeatureDataResult>,
  blocks: RenderBlock[],
  regions: RegionWithData[],
  options: FeatureBandPaint,
) {
  paintFeatureBandGlyphs(ctx, dataMap, blocks, options)
  paintFeatureBandLabels(ctx, dataMap, regions, options)
}
