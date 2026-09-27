import {
  GLYPH_DIAMOND,
  GLYPH_DISC,
  GLYPH_TRIANGLE,
} from '@jbrowse/render-core/shaders/pointMarkConsts'

import type { ShapeName } from './markEncodingTypes.ts'

/**
 * #api
 * The `point` mark's painter code for each shape an encoding can name.
 */
export const SHAPE_CODES: Record<ShapeName, number> = {
  circle: GLYPH_DISC,
  'triangle-down': GLYPH_TRIANGLE,
  diamond: GLYPH_DIAMOND,
}

export { SHAPE_NAMES } from './shapeNameList.ts'
