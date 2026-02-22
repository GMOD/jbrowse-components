import { boxGlyph } from './box.ts'
import { cdsGlyph } from './cds.ts'
import { findGlyph } from './index.ts'
import { matureProteinRegionGlyph } from './matureProteinRegion.ts'
import { processedTranscriptGlyph } from './processed.ts'
import { repeatRegionGlyph } from './repeatRegion.ts'
import { segmentsGlyph } from './segments.ts'

import type { RenderConfigContext } from '../renderConfig.ts'
import type { Glyph } from '../types.ts'
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
  return findGlyph(feature, configContext, childGlyphs)
}
