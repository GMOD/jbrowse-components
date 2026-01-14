import { boxGlyph, builtinGlyphs, findPluggableGlyph } from './glyphs/index.ts'

import type { DrawContext, FeatureLayout, Glyph } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

// Auto-generate glyph map from builtin glyphs
const glyphMap: Record<string, Glyph> = Object.fromEntries(
  builtinGlyphs.map(g => [g.type, g]),
)

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
  const pluggableGlyph = findPluggableGlyph(layout.feature, pluginManager)

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
