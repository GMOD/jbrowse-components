import { boxGlyph } from './box'
import { cdsGlyph } from './cds'
import { matureProteinRegionGlyph } from './matureProteinRegion'
import { processedTranscriptGlyph } from './processed'
import { repeatRegionGlyph } from './repeatRegion'
import { segmentsGlyph } from './segments'
import { subfeaturesGlyph } from './subfeatures'

import type { RenderConfigContext } from '../renderConfig'
import type { Glyph } from '../types'
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

export { boxGlyph } from './box'
export { cdsGlyph } from './cds'
export { matureProteinRegionGlyph } from './matureProteinRegion'
export { processedTranscriptGlyph } from './processed'
export { repeatRegionGlyph } from './repeatRegion'
export { segmentsGlyph } from './segments'
export { subfeaturesGlyph } from './subfeatures'
