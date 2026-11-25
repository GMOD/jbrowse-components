/**
 * The records band's paint, the one composition the screen and the SVG
 * export both run, so the export draws the band the reader saw.
 */
import {
  paintFeatureBandGlyphs,
  paintFeatureBandLabels,
} from '@jbrowse/plugin-features/band'

import type { VariantTopBands } from './variantTopBands.ts'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type {
  FeatureDataResult,
  FeatureGroupSection,
  LabelPlacementContext,
} from '@jbrowse/plugin-features/band'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

type BandRegions = Parameters<typeof paintFeatureBandLabels>[2]

// Hand-written rather than the model type, which the lazily loaded export
// cannot import without a circular reference.
export interface RecordsBandPaintModel {
  topBands: VariantTopBands
  renderBlocks: RenderBlock[]
  recordsLaidOutDataMap: ReadonlyMap<number, FeatureDataResult>
  recordsRenderedLabels: LabelPlacementContext
  recordsGroupSections: FeatureGroupSection[]
  recordsScrollTop: number
}

interface RecordsBandFrame {
  canvasWidth: number
  regions: BandRegions
  palette: JBrowsePalette
  fontFamily?: string
}

/**
 * The band's glyphs and labels as two painters, so an export can rasterize the
 * glyphs and keep the labels text. Reads the model when called, so a React
 * caller calls it in its render body, where the reads are tracked, and paints
 * from an effect.
 */
export function recordsBandLayerPainters(
  model: RecordsBandPaintModel,
  { canvasWidth, regions, palette, fontFamily }: RecordsBandFrame,
) {
  const dataMap = model.recordsLaidOutDataMap
  const blocks = model.renderBlocks
  const options = {
    canvasWidth,
    bandHeight: model.topBands.reserved.records,
    scrollY: model.recordsScrollTop,
    ...model.recordsRenderedLabels,
    fontFamily,
    palette,
  }
  return {
    glyphs: (ctx: Ctx2D) => {
      paintFeatureBandGlyphs(ctx, dataMap, blocks, options)
    },
    labels: (ctx: Ctx2D) => {
      paintFeatureBandLabels(ctx, dataMap, regions, options)
    },
  }
}

/** The band's painter for one canvas: glyphs, then labels over them. */
export function recordsBandPainter(
  model: RecordsBandPaintModel,
  frame: RecordsBandFrame,
) {
  const { glyphs, labels } = recordsBandLayerPainters(model, frame)
  return (ctx: Ctx2D) => {
    glyphs(ctx)
    labels(ctx)
  }
}

/** The record sections where the band draws them, scrolled with it. */
export function recordsSectionsInBand(model: RecordsBandPaintModel) {
  const scrollTop = model.recordsScrollTop
  return model.recordsGroupSections.map(section => ({
    ...section,
    top: section.top - scrollTop,
  }))
}
