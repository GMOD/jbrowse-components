import { HP_GLSL_CORE } from '@jbrowse/core/gpu/shaderConstants'

export { splitPositionWithFrac } from '@jbrowse/core/gpu/webglUtils'

export const FLIP_GLSL = `
uniform float u_reversed;
float flip_x(float x) { return mix(x, -x, u_reversed); }
`

export const HP_GLSL_FUNCTIONS = `
${HP_GLSL_CORE}

// WARNING: same compiler guards as hp_to_clip_x. Do not simplify.
float hp_scale_linear(vec2 split_pos, vec3 bp_range) {
  float inf = 1.0 / u_zero;
  float step = 1.0 / bp_range.z;
  float hi = max(split_pos.x - bp_range.x, -inf);
  float lo = max(split_pos.y - bp_range.y, -inf);
  return dot(vec2(hi, lo), vec2(step, step));
}
`
