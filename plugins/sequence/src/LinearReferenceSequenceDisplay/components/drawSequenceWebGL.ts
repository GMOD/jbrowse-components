import {
  defaultCodonTable,
  defaultStarts,
  defaultStops,
  generateCodonTable,
} from '@jbrowse/core/util'

import {
  SEQUENCE_FRAGMENT_SHADER,
  SEQUENCE_VERTEX_SHADER,
} from './sequenceShaders.ts'

import type { SequenceRegionData } from '../model.ts'
import type { Frame } from '@jbrowse/core/util'
import type { Theme } from '@mui/material'

type RGB = readonly [number, number, number]

interface RenderSettings {
  showForward: boolean
  showReverse: boolean
  showTranslation: boolean
  sequenceType: string
  rowHeight: number
  reversed: boolean
  colorByCDS: boolean
  showSequence: boolean
  showBorders: boolean
}

function hexToRGB(hex: string): RGB {
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

const DEFAULT_BASE_COLOR: RGB = [170, 170, 170]
const DEFAULT_FRAME_COLOR: RGB = [200, 200, 200]

interface ColorPalette {
  baseColors: Map<string, RGB>
  frameColors: Map<number, RGB>
  frameCDSColors: Map<number, RGB>
  startColor: RGB
  stopColor: RGB
}

function buildColorPalette(theme: Theme): ColorPalette {
  const baseColors = new Map<string, RGB>()
  for (const base of ['A', 'C', 'G', 'T']) {
    // @ts-expect-error
    const color = theme.palette.bases[base] as { main: string } | undefined
    baseColors.set(base, color ? hexToRGB(color.main) : DEFAULT_BASE_COLOR)
  }

  const frameColors = new Map<number, RGB>()
  const frameCDSColors = new Map<number, RGB>()
  for (const frame of [1, 2, 3, -1, -2, -3] as Frame[]) {
    const entry = theme.palette.frames.at(frame)
    frameColors.set(frame, entry ? hexToRGB(entry.main) : DEFAULT_FRAME_COLOR)
    const cdsEntry = theme.palette.framesCDS.at(frame)
    frameCDSColors.set(
      frame,
      cdsEntry ? hexToRGB(cdsEntry.main) : DEFAULT_FRAME_COLOR,
    )
  }

  return {
    baseColors,
    frameColors,
    frameCDSColors,
    startColor: hexToRGB(theme.palette.startCodon),
    stopColor: hexToRGB(theme.palette.stopCodon),
  }
}

const codonTable = generateCodonTable(defaultCodonTable)

const complementMap: Record<string, string> = {
  A: 'T',
  T: 'A',
  G: 'C',
  C: 'G',
  a: 't',
  t: 'a',
  g: 'c',
  c: 'g',
}

const startsSet = new Set(defaultStarts)
const stopsSet = new Set(defaultStops)

// alpha=255 means border-eligible, alpha=254 means no border
const BORDER_ALPHA = 255
const NO_BORDER_ALPHA = 254

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

  push(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    g: number,
    b: number,
    border: boolean,
  ) {
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
    this.colors[i + 3] = border ? BORDER_ALPHA : NO_BORDER_ALPHA
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
  palette: ColorPalette,
) {
  const {
    showForward,
    showReverse,
    showTranslation,
    sequenceType,
    rowHeight,
    reversed,
    colorByCDS,
    showSequence,
    showBorders,
  } = settings
  const { seq, start } = data
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

  const estimated = seq.length * 2 + topFrames.length + bottomFrames.length
  const writer = new GeometryWriter(estimated)
  let currentY = 0

  for (const frame of topFrames) {
    writeTranslationRects(
      writer,
      seq,
      start,
      frame,
      currentY,
      rowHeight,
      reversed,
      colorByCDS,
      showBorders,
      palette,
    )
    currentY += rowHeight
  }

  if (showForward && showSequence) {
    writeBaseRects(
      writer,
      seq,
      start,
      currentY,
      rowHeight,
      showBorders,
      reversed,
      false,
      palette,
    )
    currentY += rowHeight
  }

  if (showReverseActual && showSequence) {
    writeBaseRects(
      writer,
      seq,
      start,
      currentY,
      rowHeight,
      showBorders,
      reversed,
      true,
      palette,
    )
    currentY += rowHeight
  }

  for (const frame of bottomFrames) {
    writeTranslationRects(
      writer,
      seq,
      start,
      frame,
      currentY,
      rowHeight,
      !reversed,
      colorByCDS,
      showBorders,
      palette,
    )
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
  showBorders: boolean,
  reversed: boolean,
  useComplement: boolean,
  palette: ColorPalette,
) {
  const doComplement = reversed !== useComplement
  // eslint-disable-next-line unicorn/no-for-loop
  for (let i = 0; i < seq.length; i++) {
    let base = seq[i]!
    if (doComplement) {
      base = complementMap[base] ?? base
    }
    const [r, g, b] =
      palette.baseColors.get(base.toUpperCase()) ?? DEFAULT_BASE_COLOR
    writer.push(seqStart + i, y, 1, height, r, g, b, showBorders)
  }
}

function revcomCodonUpper(seq: string, i: number) {
  const c0 = seq[i]!.toUpperCase()
  const c1 = seq[i + 1]!.toUpperCase()
  const c2 = seq[i + 2]!.toUpperCase()
  return (
    (complementMap[c2] ?? c2) +
    (complementMap[c1] ?? c1) +
    (complementMap[c0] ?? c0)
  )
}

function codonUpper(seq: string, i: number) {
  return (
    seq[i]!.toUpperCase() +
    seq[i + 1]!.toUpperCase() +
    seq[i + 2]!.toUpperCase()
  )
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
  showBorders: boolean,
  palette: ColorPalette,
) {
  const frameColorMap = colorByCDS
    ? palette.frameCDSColors
    : palette.frameColors
  const [bgR, bgG, bgB] = frameColorMap.get(frame) ?? DEFAULT_FRAME_COLOR
  const { startColor, stopColor } = palette

  const normalizedFrame = Math.abs(frame) - 1
  const seqFrame = seqStart % 3
  const frameShift = (normalizedFrame - seqFrame + 3) % 3

  const frameShiftAdjustedSeqLength = seq.length - frameShift
  const multipleOfThreeLength =
    frameShiftAdjustedSeqLength - (frameShiftAdjustedSeqLength % 3)
  const sliceEnd = frameShift + multipleOfThreeLength

  if (showBorders) {
    if (frameShift > 0) {
      writer.push(seqStart, y, frameShift, height, bgR, bgG, bgB, false)
    }
    const trailing = seq.length - sliceEnd
    if (trailing > 0) {
      writer.push(
        seqStart + sliceEnd,
        y,
        trailing,
        height,
        bgR,
        bgG,
        bgB,
        false,
      )
    }

    for (let i = frameShift; i < sliceEnd; i += 3) {
      const upperCodon = reverse ? revcomCodonUpper(seq, i) : codonUpper(seq, i)

      let cr = bgR
      let cg = bgG
      let cb = bgB
      if (startsSet.has(upperCodon)) {
        cr = startColor[0]
        cg = startColor[1]
        cb = startColor[2]
      } else if (stopsSet.has(upperCodon)) {
        cr = stopColor[0]
        cg = stopColor[1]
        cb = stopColor[2]
      }
      writer.push(seqStart + i, y, 3, height, cr, cg, cb, true)
    }
  } else {
    writer.push(seqStart, y, seq.length, height, bgR, bgG, bgB, false)

    for (let i = frameShift; i < sliceEnd; i += 3) {
      const upperCodon = reverse ? revcomCodonUpper(seq, i) : codonUpper(seq, i)

      if (startsSet.has(upperCodon)) {
        writer.push(
          seqStart + i,
          y,
          3,
          height,
          startColor[0],
          startColor[1],
          startColor[2],
          false,
        )
      } else if (stopsSet.has(upperCodon)) {
        writer.push(
          seqStart + i,
          y,
          3,
          height,
          stopColor[0],
          stopColor[1],
          stopColor[2],
          false,
        )
      }
    }
  }
}

function createShader(
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
  uBorderWidth: WebGLUniformLocation
}

export function initGL(gl: WebGL2RenderingContext): GLHandles {
  const program = createProgram(
    gl,
    SEQUENCE_VERTEX_SHADER,
    SEQUENCE_FRAGMENT_SHADER,
  )

  const vao = gl.createVertexArray()
  gl.bindVertexArray(vao)

  const rectBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, rectBuffer)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0)
  gl.vertexAttribDivisor(0, 1)

  const colorBuffer = gl.createBuffer()
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
    uBorderWidth: gl.getUniformLocation(program, 'u_borderWidth')!,
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
  const w = Math.round(cssWidth * dpr)
  const h = Math.round(cssHeight * dpr)
  if (gl.canvas.width !== w || gl.canvas.height !== h) {
    gl.canvas.width = w
    gl.canvas.height = h
  }
  gl.viewport(0, 0, w, h)
  gl.clearColor(1, 1, 1, 1)
  gl.clear(gl.COLOR_BUFFER_BIT)

  if (instanceCount === 0) {
    return
  }

  gl.useProgram(handles.program)
  gl.uniform1f(handles.uOffsetPx, offsetPx)
  gl.uniform1f(handles.uBpPerPx, bpPerPx)
  gl.uniform1f(handles.uCanvasWidth, cssWidth)
  gl.uniform1f(handles.uCanvasHeight, cssHeight)
  gl.uniform1f(handles.uBorderWidth, 1 / bpPerPx >= 12 ? 1 : 0)

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

export { buildColorPalette, codonTable }
export type { ColorPalette, RenderSettings }
