import { colord } from '@jbrowse/core/util/colord'

// High-precision GLSL functions for genomic coordinates
// Splits large integers into high/low parts to maintain precision in shaders
export const HP_GLSL_FUNCTIONS = `
const uint HP_LOW_MASK = 0xFFFu;

vec2 hpSplitUint(uint value) {
  uint lo = value & HP_LOW_MASK;
  uint hi = value - lo;
  return vec2(float(hi), float(lo));
}

float hpScaleLinear(vec2 splitPos, vec3 bpRange) {
  float hi = splitPos.x - bpRange.x;
  float lo = splitPos.y - bpRange.y;
  return (hi + lo) / bpRange.z;
}

float hpToClipX(vec2 splitPos, vec3 bpRange) {
  return hpScaleLinear(splitPos, bpRange) * 2.0 - 1.0;
}
`

export function splitPositionWithFrac(value: number): [number, number] {
  const intValue = Math.floor(value)
  const frac = value - intValue
  const loInt = intValue & 0xfff
  const hi = intValue - loInt
  const lo = loInt + frac
  return [hi, lo]
}

export function createShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`Shader compile error: ${info}`)
  }
  return shader
}

export function createProgram(
  gl: WebGL2RenderingContext,
  vsSource: string,
  fsSource: string,
) {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource)
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource)
  const program = gl.createProgram()
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  gl.detachShader(program, vs)
  gl.detachShader(program, fs)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(`Program link error: ${info}`)
  }
  return program
}

export function cacheUniforms(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  names: string[],
) {
  const cache: Record<string, WebGLUniformLocation | null> = {}
  for (const name of names) {
    cache[name] = gl.getUniformLocation(program, name)
  }
  return cache
}

export function colorToRGBA(color: string): [number, number, number, number] {
  const c = colord(color)
  const { r, g, b, a } = c.toRgb()
  return [r, g, b, Math.round(a * 255)]
}
