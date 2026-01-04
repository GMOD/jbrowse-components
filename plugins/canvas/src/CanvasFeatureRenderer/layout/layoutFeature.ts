import { builtinGlyphs, findGlyph, findPluggableGlyph } from '../glyphs'
import { applyLabelDimensions } from '../labelUtils'

import type { RenderConfigContext } from '../renderConfig'
import type { FeatureLayout, LayoutArgs } from '../types'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'

// Re-export for backwards compatibility
export { applyLabelDimensions } from '../labelUtils'

/**
 * Layout a feature using the polymorphic glyph system.
 *
 * Phase 1 of the two-phase rendering:
 * 1. Find the matching glyph for the feature
 * 2. Call the glyph's layout function to allocate its rectangle
 * 3. Apply label dimensions
 */
export function layoutFeature(args: {
  feature: Feature
  bpPerPx: number
  reversed: boolean
  configContext: RenderConfigContext
  pluginManager?: PluginManager
  isNested?: boolean
  isTranscriptChild?: boolean
}): FeatureLayout {
  const {
    feature,
    bpPerPx,
    reversed,
    configContext,
    pluginManager,
    isNested = false,
    isTranscriptChild = false,
  } = args

  // Check for pluggable glyph first (higher priority)
  const pluggableGlyph = findPluggableGlyph(feature, pluginManager)

  let layout: FeatureLayout

  if (pluggableGlyph) {
    // Use pluggable glyph's layout (legacy interface)
    // TODO: Migrate pluggable glyphs to new Glyph interface
    const heightMultiplier =
      pluggableGlyph.getHeightMultiplier?.(feature, configContext.config) ?? 1
    const baseGlyph = findGlyph(feature, configContext, builtinGlyphs)

    const layoutArgs: LayoutArgs = {
      feature,
      bpPerPx,
      reversed,
      configContext,
      pluginManager,
    }

    layout = baseGlyph.layout(layoutArgs)

    // Apply height multiplier from pluggable glyph
    layout.height *= heightMultiplier
    layout.totalLayoutHeight *= heightMultiplier
  } else {
    // Use builtin polymorphic glyph
    const glyph = findGlyph(feature, configContext, builtinGlyphs)

    const layoutArgs: LayoutArgs = {
      feature,
      bpPerPx,
      reversed,
      configContext,
      pluginManager,
    }

    layout = glyph.layout(layoutArgs)
  }

  // Apply label dimensions
  applyLabelDimensions(layout, {
    feature,
    configContext,
    isNested,
    isTranscriptChild,
  })

  return layout
}
