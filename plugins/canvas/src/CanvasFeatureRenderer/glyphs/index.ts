import { boxGlyph } from './box'
import { cdsGlyph } from './cds'
import { matureProteinRegionGlyph } from './matureProteinRegion'
import { processedTranscriptGlyph } from './processed'
import { repeatRegionGlyph } from './repeatRegion'
import { segmentsGlyph } from './segments'
import { subfeaturesGlyph } from './subfeatures'

import type { Glyph } from '../types'
import type { RenderConfigContext } from '../renderConfig'
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

export {
  boxGlyph,
  cdsGlyph,
  matureProteinRegionGlyph,
  processedTranscriptGlyph,
  repeatRegionGlyph,
  segmentsGlyph,
  subfeaturesGlyph,
}
