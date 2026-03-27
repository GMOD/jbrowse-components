export { splitPositionWithFrac } from '@jbrowse/core/gpu/webglUtils'
export { HP_GLSL_WITH_UNIFORM as HP_GLSL_FUNCTIONS } from '@jbrowse/alignments-core'

export const FLIP_GLSL = `
uniform float u_reversed;
float flip_x(float x) { return mix(x, -x, u_reversed); }
`
