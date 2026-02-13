import {
  complement,
  defaultCodonTable,
  defaultStarts,
  defaultStops,
  generateCodonTable,
  revcom,
} from '@jbrowse/core/util'

import {
  SEQUENCE_FRAGMENT_SHADER,
  SEQUENCE_VERTEX_SHADER,
} from './sequenceShaders.ts'

import type { Frame } from '@jbrowse/core/util'
import type { Theme } from '@mui/material'

interface SequenceRegionData {
  seq: string
  start: number
  end: number
}

interface RenderSettings {
  showForward: boolean
  showReverse: boolean
  showTranslation: boolean
  sequenceType: string
  rowHeight: number
  reversed: boolean
  colorByCDS: boolean
}

function hexToRGB(hex: string) {
  const h = hex.replace('#', '')
  const full =
    h.length === 3
      ? h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!
      : h.length === 4
        ? h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]! + h[3]! + h[3]!
        : h
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ] as const
}

function getBaseColor(base: string, theme: Theme) {
  // @ts-expect-error
  const color = theme.palette.bases[base.toUpperCase()] as
    | { main: string }
    | undefined
  if (color) {
    return hexToRGB(color.main)
  }
  return [170, 170, 170] as const
}

function getFrameColor(frame: Frame, colorByCDS: boolean, theme: Theme) {
  const palette = colorByCDS ? theme.palette.framesCDS : theme.palette.frames
  const entry = palette.at(frame)
  if (entry) {
    return hexToRGB(entry.main)
  }
  return [200, 200, 200] as const
}

const codonTable = generateCodonTable(defaultCodonTable)

class GeometryWriter {
  rects: Float32Array
  colors: Uint8Array
  count = 0
  capacity: number

  constructor(initialCapacity: number) {
    this.capacity = initialCapacity
    this.rects = new Float32Array(initialCapacity * 4)
    this.colors = new Uint8Array(initialCapacity * 4)
  }

  private grow() {
    this.capacity *= 2
    const newRects = new Float32Array(this.capacity * 4)
    const newColors = new Uint8Array(this.capacity * 4)
    newRects.set(this.rects)
    newColors.set(this.colors)
    this.rects = newRects
    this.colors = newColors
  }

  push(x: number, y: number, w: number, h: number, r: number, g: number, b: number) {
    if (this.count >= this.capacity) {
      this.grow()
    }
    const i = this.count * 4
    this.rects[i] = x
    this.rects[i + 1] = y
    this.rects[i + 2] = w
    this.rects[i + 3] = h
    this.colors[i] = r
    this.colors[i + 1] = g
    this.colors[i + 2] = b
    this.colors[i + 3] = 255
    this.count++
  }

  result() {
    return {
      rectBuf: this.rects.subarray(0, this.count * 4),
      colorBuf: this.colors.subarray(0, this.count * 4),
      instanceCount: this.count,
    }
  }
}

export function buildSequenceGeometry(
  data: SequenceRegionData,
  settings: RenderSettings,
  theme: Theme,
) {
  const { seq, start } = data
  const {
    showForward,
    showReverse,
    showTranslation,
    sequenceType,
    rowHeight,
    reversed,
    colorByCDS,
  } = settings
  const isDna = sequenceType === 'dna'
  const showReverseActual = isDna ? showReverse : false
  const showTranslationActual = isDna ? showTranslation : false

  const forwardFrames: Frame[] =
    showTranslationActual && showForward ? [3, 2, 1] : []
  const reverseFrames: Frame[] =
    showTranslationActual && showReverseActual ? [-1, -2, -3] : []

  const [topFrames, bottomFrames] = reversed
    ? [reverseFrames.toReversed(), forwardFrames.toReversed()]
    : [forwardFrames, reverseFrames]

  // estimate: each base = 1 rect, each translation frame = 1 bg + ~1/3 codons highlighted
  const estimated = seq.length * 2 + topFrames.length + bottomFrames.length
  const writer = new GeometryWriter(estimated)
  let currentY = 0

  for (const frame of topFrames) {
    writeTranslationRects(writer, seq, start, frame, currentY, rowHeight, reversed, colorByCDS, theme)
    currentY += rowHeight
  }

  if (showForward) {
    const fwdSeq = reversed ? complement(seq) : seq
    writeBaseRects(writer, fwdSeq, start, currentY, rowHeight, theme)
    currentY += rowHeight
  }

  if (showReverseActual) {
    const revSeq = reversed ? seq : complement(seq)
    writeBaseRects(writer, revSeq, start, currentY, rowHeight, theme)
    currentY += rowHeight
  }

  for (const frame of bottomFrames) {
    writeTranslationRects(writer, seq, start, frame, currentY, rowHeight, !reversed, colorByCDS, theme)
    currentY += rowHeight
  }

  return writer.result()
}

function writeBaseRects(
  writer: GeometryWriter,
  seq: string,
  seqStart: number,
  y: number,
  height: number,
  theme: Theme,
) {
  // eslint-disable-next-line unicorn/no-for-loop
  for (let i = 0; i < seq.length; i++) {
    const [r, g, b] = getBaseColor(seq[i]!, theme)
    writer.push(seqStart + i, y, 1, height, r, g, b)
  }
}

function writeTranslationRects(
  writer: GeometryWriter,
  seq: string,
  seqStart: number,
  frame: Frame,
  y: number,
  height: number,
  reverse: boolean,
  colorByCDS: boolean,
  theme: Theme,
) {
  const [bgR, bgG, bgB] = getFrameColor(frame, colorByCDS, theme)
  writer.push(seqStart, y, seq.length, height, bgR, bgG, bgB)

  const normalizedFrame = Math.abs(frame) - 1
  const seqFrame = seqStart % 3
  const frameShift = (normalizedFrame - seqFrame + 3) % 3

  const frameShiftAdjustedSeqLength = seq.length - frameShift
  const multipleOfThreeLength =
    frameShiftAdjustedSeqLength - (frameShiftAdjustedSeqLength % 3)
  const seqSliced = seq.slice(frameShift, frameShift + multipleOfThreeLength)

  const startColor = hexToRGB(theme.palette.startCodon)
  const stopColor = hexToRGB(theme.palette.stopCodon)

  for (let i = 0; i < seqSliced.length; i += 3) {
    const codon = seqSliced.slice(i, i + 3)
    const normalizedCodon = reverse ? revcom(codon) : codon
    const upperCodon = normalizedCodon.toUpperCase()

    if (defaultStarts.includes(upperCodon)) {
      writer.push(seqStart + frameShift + i, y, 3, height, startColor[0], startColor[1], startColor[2])
    } else if (defaultStops.includes(upperCodon)) {
      writer.push(seqStart + frameShift + i, y, 3, height, stopColor[0], stopColor[1], stopColor[2])
    }
  }
}

function createShader(gl: WebGL2RenderingContext, type: number, source: string) {
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

function createProgram(
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
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program)
    throw new Error(`Program link error: ${info}`)
  }
  return program
}

export interface GLHandles {
  program: WebGLProgram
  vao: WebGLVertexArrayObject
  rectBuffer: WebGLBuffer
  colorBuffer: WebGLBuffer
  uOffsetPx: WebGLUniformLocation
  uBpPerPx: WebGLUniformLocation
  uCanvasWidth: WebGLUniformLocation
  uCanvasHeight: WebGLUniformLocation
}

export function initGL(gl: WebGL2RenderingContext): GLHandles {
  const program = createProgram(gl, SEQUENCE_VERTEX_SHADER, SEQUENCE_FRAGMENT_SHADER)

  const vao = gl.createVertexArray()!
  gl.bindVertexArray(vao)

  const rectBuffer = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, rectBuffer)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0)
  gl.vertexAttribDivisor(0, 1)

  const colorBuffer = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer)
  gl.enableVertexAttribArray(1)
  gl.vertexAttribPointer(1, 4, gl.UNSIGNED_BYTE, true, 0, 0)
  gl.vertexAttribDivisor(1, 1)

  gl.bindVertexArray(null)

  return {
    program,
    vao,
    rectBuffer,
    colorBuffer,
    uOffsetPx: gl.getUniformLocation(program, 'u_offsetPx')!,
    uBpPerPx: gl.getUniformLocation(program, 'u_bpPerPx')!,
    uCanvasWidth: gl.getUniformLocation(program, 'u_canvasWidth')!,
    uCanvasHeight: gl.getUniformLocation(program, 'u_canvasHeight')!,
  }
}

export function uploadGeometry(
  gl: WebGL2RenderingContext,
  handles: GLHandles,
  rectBuf: Float32Array,
  colorBuf: Uint8Array,
) {
  gl.bindBuffer(gl.ARRAY_BUFFER, handles.rectBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, rectBuf, gl.STATIC_DRAW)
  gl.bindBuffer(gl.ARRAY_BUFFER, handles.colorBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, colorBuf, gl.STATIC_DRAW)
}

export function render(
  gl: WebGL2RenderingContext,
  handles: GLHandles,
  instanceCount: number,
  offsetPx: number,
  bpPerPx: number,
  cssWidth: number,
  cssHeight: number,
) {
  const dpr = window.devicePixelRatio || 1
  gl.canvas.width = cssWidth * dpr
  gl.canvas.height = cssHeight * dpr
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
  gl.clearColor(1, 1, 1, 1)
  gl.clear(gl.COLOR_BUFFER_BIT)

  if (instanceCount === 0) {
    return
  }

  gl.useProgram(handles.program)
  // uniforms in CSS pixel space - gl.viewport handles DPR mapping
  gl.uniform1f(handles.uOffsetPx, offsetPx)
  gl.uniform1f(handles.uBpPerPx, bpPerPx)
  gl.uniform1f(handles.uCanvasWidth, cssWidth)
  gl.uniform1f(handles.uCanvasHeight, cssHeight)

  gl.bindVertexArray(handles.vao)
  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, instanceCount)
  gl.bindVertexArray(null)
}

export function disposeGL(gl: WebGL2RenderingContext, handles: GLHandles) {
  gl.deleteBuffer(handles.rectBuffer)
  gl.deleteBuffer(handles.colorBuffer)
  gl.deleteVertexArray(handles.vao)
  gl.deleteProgram(handles.program)
}

export { codonTable }
export type { RenderSettings, SequenceRegionData }
