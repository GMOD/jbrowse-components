import {
  GLYPH_DIAMOND,
  GLYPH_DISC,
  GLYPH_TRIANGLE,
} from '@jbrowse/render-core/shaders/pointMarkConsts'

import type { GlyphName } from './markEncodingTypes.ts'

/**
 * #api
 * The `point` shape's glyph code for each name an encoding can say.
 */
export const GLYPH_CODES: Record<GlyphName, number> = {
  disc: GLYPH_DISC,
  triangle: GLYPH_TRIANGLE,
  diamond: GLYPH_DIAMOND,
}

/** The glyph names in range order: what an unlisted `range` hands out. */
export const GLYPH_NAMES = Object.keys(GLYPH_CODES) as GlyphName[]
