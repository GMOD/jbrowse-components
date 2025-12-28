import {
  boxGlyph,
  cdsGlyph,
  matureProteinRegionGlyph,
  processedTranscriptGlyph,
  repeatRegionGlyph,
  segmentsGlyph,
  subfeaturesGlyph,
} from './glyphs'

import type { DrawContext, FeatureLayout, Glyph } from './types'
import type PluginManager from '@jbrowse/core/PluginManager'
import type GlyphType from '@jbrowse/core/pluggableElementTypes/GlyphType'

// Map glyph types to their glyph objects
const glyphMap: Record<string, Glyph> = {
  Box: boxGlyph,
  CDS: cdsGlyph,
  MatureProteinRegion: matureProteinRegionGlyph,
  ProcessedTranscript: processedTranscriptGlyph,
  RepeatRegion: repeatRegionGlyph,
  Segments: segmentsGlyph,
  Subfeatures: subfeaturesGlyph,
}

/**
 * Find a matching pluggable glyph from the plugin manager.
 */
function findPluggableGlyph(
  layout: FeatureLayout,
  pluginManager?: PluginManager,
): GlyphType | undefined {
  if (!pluginManager) {
    return undefined
  }
  const glyphTypes = pluginManager.getGlyphTypes()
  const sortedGlyphs = [...glyphTypes].sort((a, b) => b.priority - a.priority)
  return sortedGlyphs.find(glyph => glyph.match?.(layout.feature))
}

/**
 * Draw a feature using the polymorphic glyph system.
 *
 * Phase 2 of the two-phase rendering:
 * 1. Look up the glyph by type from the layout
 * 2. Call the glyph's draw function
 *
 * The layout already contains the allocated rectangle - the glyph
 * just draws itself within that space.
 */
export function drawFeature(
  ctx: CanvasRenderingContext2D,
  layout: FeatureLayout,
  drawContext: DrawContext,
  pluginManager?: PluginManager,
): void {
  // Check for pluggable glyph first
  const pluggableGlyph = findPluggableGlyph(layout, pluginManager)

  if (pluggableGlyph) {
    // Use pluggable glyph's draw (legacy interface)
    pluggableGlyph.draw({
      ctx,
      feature: layout.feature,
      featureLayout: layout,
      region: drawContext.region,
      bpPerPx: drawContext.bpPerPx,
      config: drawContext.configContext.config,
      theme: drawContext.theme,
      reversed: drawContext.region.reversed ?? false,
      topLevel: true,
      canvasWidth: drawContext.canvasWidth,
    })
    return
  }

  // Use builtin glyph based on layout's glyphType
  const glyph = glyphMap[layout.glyphType]
  if (glyph) {
    glyph.draw(ctx, layout, drawContext)
  } else {
    // Fallback to box
    boxGlyph.draw(ctx, layout, drawContext)
  }
}
