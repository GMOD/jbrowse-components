// Instancing limits
export const MAX_VISIBLE_CHEVRONS_PER_LINE = 128

// Drawing dimensions (in pixels)
// GPU shaders use these as half-dimensions directly (e.g., half_w = 4.5 / canvas_width)
// SYNC: must match min_width in WGSL (canvasShaders.ts) and GLSL (canvasGlslShaders.ts)
export const MIN_RECT_WIDTH_PX = 2
export const CHEVRON_SPACING_PX = 25
export const CHEVRON_W_PX = 4.5
export const CHEVRON_H_PX = 4.5
export const STEM_LENGTH_PX = 7
export const STEM_HALF_H_PX = 0.5
export const HEAD_HALF_H_PX = 2.5
