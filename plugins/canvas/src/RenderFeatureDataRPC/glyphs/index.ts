import { boxGlyph } from './box.ts'
import { cdsGlyph } from './cds.ts'
import { matureProteinRegionGlyph } from './matureProteinRegion.ts'
import { processedTranscriptGlyph } from './processed.ts'
import { repeatRegionGlyph } from './repeatRegion.ts'
import { segmentsGlyph } from './segments.ts'
import { subfeaturesGlyph } from './subfeatures.ts'

import type { RenderConfigContext } from '../renderConfig.ts'
import type { Glyph } from '../types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type GlyphType from '@jbrowse/core/pluggableElementTypes/GlyphType'
import type { Feature } from '@jbrowse/core/util'

// Glyphs in priority order (first match wins)
// More specific glyphs should come before more general ones
export const builtinGlyphs: Glyph[] = [
  matureProteinRegionGlyph, // CDS with mature protein regions
  repeatRegionGlyph, // repeat_region with subfeatures
  cdsGlyph,
  processedTranscriptGlyph,
  subfeaturesGlyph,
  segmentsGlyph,
  boxGlyph, // fallback - matches everything
]

/**
 * Find the glyph that matches the given feature.
 * Returns the first matching glyph from the registry.
 */
export function findGlyph(
  feature: Feature,
  configContext: RenderConfigContext,
  glyphs: Glyph[] = builtinGlyphs,
): Glyph {
  const match = glyphs.find(g => g.match(feature, configContext))
  // boxGlyph is the fallback and matches everything
  return match ?? boxGlyph
}

/**
 * Find a matching pluggable glyph from the plugin manager.
 * Pluggable glyphs take priority over builtin glyphs.
 */
export function findPluggableGlyph(
  feature: Feature,
  pluginManager?: PluginManager,
): GlyphType | undefined {
  if (!pluginManager) {
    return undefined
  }
  const glyphTypes = pluginManager.getGlyphTypes()
  const sortedGlyphs = [...glyphTypes].sort((a, b) => b.priority - a.priority)
  return sortedGlyphs.find(glyph => glyph.match?.(feature))
}

// Only export boxGlyph for use as fallback in drawFeature.ts
export { boxGlyph } from './box.ts'
