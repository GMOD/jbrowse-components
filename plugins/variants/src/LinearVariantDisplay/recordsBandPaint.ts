/**
 * The records band's paint, the one composition the screen and the SVG
 * export both run, so the export draws the band the reader saw.
 */
import { paintFeatureBand } from '@jbrowse/plugin-features/band'

import type { VariantTopBands } from './variantTopBands.ts'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type {
  FeatureDataResult,
  FeatureGroupSection,
} from '@jbrowse/plugin-features/band'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

type BandRegions = Parameters<typeof paintFeatureBand>[3]

// Hand-written rather than the model type, which the lazily loaded export
// cannot import without a circular reference.
export interface RecordsBandPaintModel {
  topBands: VariantTopBands
  renderBlocks: RenderBlock[]
  recordsLaidOutDataMap: ReadonlyMap<number, FeatureDataResult>
  recordsRenderedLabels: { showLabels: boolean; showDescriptions: boolean }
  recordsFontSize: number
  recordsGroupSections: FeatureGroupSection[]
  recordsScrollTop: number
}

/**
 * The band's painter. Reads the model when called, so a React caller calls it
 * in its render body, where the reads are tracked, and paints from an effect.
 */
export function recordsBandPainter(
  model: RecordsBandPaintModel,
  {
    canvasWidth,
    regions,
    palette,
  }: { canvasWidth: number; regions: BandRegions; palette: JBrowsePalette },
) {
  const dataMap = model.recordsLaidOutDataMap
  const blocks = model.renderBlocks
  const options = {
    canvasWidth,
    bandHeight: model.topBands.reserved.records,
    scrollY: model.recordsScrollTop,
    ...model.recordsRenderedLabels,
    fontSize: model.recordsFontSize,
    palette,
  }
  return (ctx: Ctx2D) => {
    paintFeatureBand(ctx, dataMap, blocks, regions, options)
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
