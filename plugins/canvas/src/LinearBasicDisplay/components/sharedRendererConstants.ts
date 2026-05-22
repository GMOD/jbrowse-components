// Re-export so display-side modules can import label dimensions from one place.
// Lives in RenderFeatureDataRPC so the worker can read it without depending on
// the display module.
export { LABEL_FONT_SIZE } from '../../RenderFeatureDataRPC/constants.ts'

// Instancing limits
export const MAX_VISIBLE_CHEVRONS_PER_LINE = 128

// Drawing dimensions (in pixels)
export { MIN_RECT_WIDTH_PX } from './shaders/rect.generated.ts'
export {
  CHEVRON_H_PX,
  CHEVRON_SPACING_PX,
  CHEVRON_THICKNESS_PX,
  CHEVRON_W_PX,
} from './shaders/chevron.generated.ts'
export {
  HEAD_HALF_H_PX,
  STEM_HALF_H_PX,
  STEM_LENGTH_PX,
} from './shaders/arrow.generated.ts'
