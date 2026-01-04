import { boxGlyph } from './box'
import { cdsGlyph } from './cds'
import { matureProteinRegionGlyph } from './matureProteinRegion'
import { processedTranscriptGlyph } from './processed'
import { repeatRegionGlyph } from './repeatRegion'
import { segmentsGlyph } from './segments'

import type { RenderConfigContext } from '../renderConfig'
import type { Glyph } from '../types'
import type { Feature } from '@jbrowse/core/util'

// Glyphs that can be used as children of container glyphs (like genes).
// This list excludes subfeaturesGlyph to avoid circular dependency.
// Order matters - more specific glyphs first.
export const childGlyphs: Glyph[] = [
  matureProteinRegionGlyph,
  repeatRegionGlyph,
  cdsGlyph,
  processedTranscriptGlyph,
  segmentsGlyph,
  boxGlyph, // fallback - matches everything
]

export function findChildGlyph(
  feature: Feature,
  configContext: RenderConfigContext,
): Glyph {
  return childGlyphs.find(g => g.match(feature, configContext)) ?? boxGlyph
}
