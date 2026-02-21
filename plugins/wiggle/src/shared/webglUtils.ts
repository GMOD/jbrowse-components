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

export function interleaveInstances(
  sources: SourceRenderData[],
  totalFeatures: number,
) {
  const buf = new ArrayBuffer(totalFeatures * INSTANCE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  let offset = 0
  for (const [idx, source] of sources.entries()) {
    const row = source.rowIndex ?? idx
    for (let i = 0; i < source.numFeatures; i++) {
      const off = (offset + i) * INSTANCE_STRIDE
      u32[off] = source.featurePositions[i * 2]!
      u32[off + 1] = source.featurePositions[i * 2 + 1]!
      f32[off + 2] = source.featureScores[i]!
      f32[off + 3] =
        i === 0 ? source.featureScores[i]! : source.featureScores[i - 1]!
      f32[off + 4] = row
      f32[off + 5] = source.color[0]
      f32[off + 6] = source.color[1]
      f32[off + 7] = source.color[2]
    }
    offset += source.numFeatures
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
