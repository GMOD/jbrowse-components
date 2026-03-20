import { colord } from '@jbrowse/core/util/colord'

import { INSTANCE_STRIDE } from './wiggleShader.ts'

import type { SourceRenderData } from './WiggleRenderer.ts'

const INSTANCE_BYTES = INSTANCE_STRIDE * 4
const HP_LOW_MASK = 0xfff

export function splitPositionWithFrac(value: number): [number, number] {
  const intValue = Math.floor(value)
  const frac = value - intValue
  const loInt = intValue & HP_LOW_MASK
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

export function lightenColor(
  rgb: [number, number, number],
  amount: number,
): [number, number, number] {
  return [
    Math.min(1, rgb[0] + (1 - rgb[0]) * amount),
    Math.min(1, rgb[1] + (1 - rgb[1]) * amount),
    Math.min(1, rgb[2] + (1 - rgb[2]) * amount),
  ]
}

export function darkenColor(
  rgb: [number, number, number],
  amount: number,
): [number, number, number] {
  return [rgb[0] * (1 - amount), rgb[1] * (1 - amount), rgb[2] * (1 - amount)]
}

export function interleaveInstances(
  sources: SourceRenderData[],
  totalFeatures: number,
) {
  const buf = new ArrayBuffer(totalFeatures * INSTANCE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  let offset = 0
  for (let idx = 0; idx < sources.length; idx++) {
    const source = sources[idx]!
    const row = source.rowIndex ?? idx
    const cr = source.color[0]
    const cg = source.color[1]
    const cb = source.color[2]
    const positions = source.featurePositions
    const scores = source.featureScores
    const n = source.numFeatures
    for (let i = 0; i < n; i++) {
      const off = (offset + i) * INSTANCE_STRIDE
      u32[off] = positions[i * 2]!
      u32[off + 1] = positions[i * 2 + 1]!
      f32[off + 2] = scores[i]!
      f32[off + 3] = i === 0 ? scores[i]! : scores[i - 1]!
      f32[off + 4] = row
      f32[off + 5] = cr
      f32[off + 6] = cg
      f32[off + 7] = cb
    }
    offset += n
  }
  return buf
}

export function computeNumRows(sources: SourceRenderData[]) {
  let numRows = 0
  for (const [i, source] of sources.entries()) {
    const r = (source.rowIndex ?? i) + 1
    if (r > numRows) {
      numRows = r
    }
  }
  return numRows
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
