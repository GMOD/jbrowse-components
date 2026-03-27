import { HP_GLSL_CORE, HP_WGSL_CORE } from '@jbrowse/core/gpu/shaderConstants'

export { HP_GLSL_CORE, HP_WGSL_CORE } from '@jbrowse/core/gpu/shaderConstants'
export { splitPositionWithFrac } from '@jbrowse/core/gpu/webglUtils'

// WGSL HP functions plus flip/snap utilities used by canvas feature shaders
export const HP_WGSL = `
${HP_WGSL_CORE}

fn flip_x(x: f32, reversed: f32) -> f32 {
  return mix(x, -x, reversed);
}

fn snap_to_pixel_x(clip_x: f32, canvas_width: f32) -> f32 {
  let px = (clip_x + 1.0) * 0.5 * canvas_width;
  return floor(px + 0.5) / canvas_width * 2.0 - 1.0;
}
`

// GLSL HP functions plus flip utility used by canvas feature shaders
export const HP_GLSL_FUNCTIONS = `
${HP_GLSL_CORE}

uniform float u_reversed;

float flip_x(float x) {
  return mix(x, -x, u_reversed);
}
`

// Instancing limits
export const MAX_VISIBLE_CHEVRONS_PER_LINE = 128

// Drawing dimensions (in pixels)
// GPU shaders use these as half-dimensions directly (e.g., half_w = 4.5 / canvas_width)
export const MIN_RECT_WIDTH_PX = 2
export const CHEVRON_SPACING_PX = 25
export const CHEVRON_W_PX = 4.5
export const CHEVRON_H_PX = 3.5
export const STEM_LENGTH_PX = 7
export const STEM_HALF_H_PX = 0.5
export const HEAD_HALF_H_PX = 2.5
