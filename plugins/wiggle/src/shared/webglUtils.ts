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

float hpScaleLinear(vec2 splitPos, vec3 domain) {
  float hi = splitPos.x - domain.x;
  float lo = splitPos.y - domain.y;
  return (hi + lo) / domain.z;
}

float hpToClipX(vec2 splitPos, vec3 domain) {
  return hpScaleLinear(splitPos, domain) * 2.0 - 1.0;
}
`

// Common score normalization functions for wiggle shaders
export const SCORE_GLSL_FUNCTIONS = `
float normalizeScore(float score, vec2 domainY, int scaleType) {
  float minScore = domainY.x;
  float maxScore = domainY.y;

  float normalizedScore;
  if (scaleType == 1) {
    // Log scale
    float logMin = log2(max(minScore, 1.0));
    float logMax = log2(max(maxScore, 1.0));
    float logScore = log2(max(score, 1.0));
    normalizedScore = (logScore - logMin) / (logMax - logMin);
  } else {
    // Linear scale
    normalizedScore = (score - minScore) / (maxScore - minScore);
  }

  return clamp(normalizedScore, 0.0, 1.0);
}

float scoreToY(float score, vec2 domainY, float height, int scaleType) {
  float normalizedScore = normalizeScore(score, domainY, scaleType);
  // Convert to pixel position (0 at top, height at bottom)
  return (1.0 - normalizedScore) * height;
}
`

/**
 * Split a position value into high and low parts for high-precision shader math.
 * This prevents floating-point precision loss when dealing with large genomic coordinates.
 */
export function splitPositionWithFrac(value: number): [number, number] {
  const intValue = Math.floor(value)
  const frac = value - intValue
  const loInt = intValue & 0xfff
  const hi = intValue - loInt
  const lo = loInt + frac
  return [hi, lo]
}

const parseColorCache = new Map<string, [number, number, number]>()

export function parseColor(color: string): [number, number, number] {
  let result = parseColorCache.get(color)
  if (!result) {
    const { r, g, b } = colord(color).toRgb()
    result = [r / 255, g / 255, b / 255]
    parseColorCache.set(color, result)
  }
  return result
}

/**
 * Create and compile a WebGL shader
 */
export function createShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
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

/**
 * Create and link a WebGL program from vertex and fragment shader sources
 */
export function createProgram(
  gl: WebGL2RenderingContext,
  vsSource: string,
  fsSource: string,
): WebGLProgram {
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

/**
 * Cache uniform locations for a program
 */
export function cacheUniforms(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  names: string[],
): Record<string, WebGLUniformLocation | null> {
  const cache: Record<string, WebGLUniformLocation | null> = {}
  for (const name of names) {
    cache[name] = gl.getUniformLocation(program, name)
  }
  return cache
}
