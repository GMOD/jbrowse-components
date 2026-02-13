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

interface RectInstance {
  x: number
  y: number
  w: number
  h: number
  r: number
  g: number
  b: number
  a: number
}

function hexToRGB(hex: string) {
  const h = hex.replace('#', '')
  const full =
    h.length === 3
      ? h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!
      : h.length === 4
        ? h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]! + h[3]! + h[3]!
        : h
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  }
}

function getBaseColor(base: string, theme: Theme) {
  const palette = theme.palette
  const upper = base.toUpperCase()
  // @ts-expect-error
  const color = palette.bases[upper] as
    | { main: string }
    | undefined
  if (color) {
    return hexToRGB(color.main)
  }
  return { r: 170, g: 170, b: 170 }
}

function getFrameColor(frame: Frame, colorByCDS: boolean, theme: Theme) {
  const palette = colorByCDS ? theme.palette.framesCDS : theme.palette.frames
  const entry = palette.at(frame)
  if (entry) {
    return hexToRGB(entry.main)
  }
  return { r: 200, g: 200, b: 200 }
}

const codonTable = generateCodonTable(defaultCodonTable)

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
  const showForwardActual = showForward
  const showReverseActual = isDna ? showReverse : false
  const showTranslationActual = isDna ? showTranslation : false

  const forwardFrames: Frame[] =
    showTranslationActual && showForwardActual ? [3, 2, 1] : []
  const reverseFrames: Frame[] =
    showTranslationActual && showReverseActual ? [-1, -2, -3] : []

  const [topFrames, bottomFrames] = reversed
    ? [reverseFrames.toReversed(), forwardFrames.toReversed()]
    : [forwardFrames, reverseFrames]

  const rects: RectInstance[] = []
  let currentY = 0

  for (const frame of topFrames) {
    buildTranslationRects(
      rects,
      seq,
      start,
      frame,
      currentY,
      rowHeight,
      reversed,
      colorByCDS,
      theme,
    )
    currentY += rowHeight
  }

  if (showForwardActual) {
    const fwdSeq = reversed ? complement(seq) : seq
    buildBaseRects(rects, fwdSeq, start, currentY, rowHeight, theme)
    currentY += rowHeight
  }

  if (showReverseActual) {
    const revSeq = reversed ? seq : complement(seq)
    buildBaseRects(rects, revSeq, start, currentY, rowHeight, theme)
    currentY += rowHeight
  }

  for (const frame of bottomFrames) {
    buildTranslationRects(
      rects,
      seq,
      start,
      frame,
      currentY,
      rowHeight,
      !reversed,
      colorByCDS,
      theme,
    )
    currentY += rowHeight
  }

  const rectBuf = new Float32Array(rects.length * 4)
  const colorBuf = new Uint8Array(rects.length * 4)
  for (const [i, r] of rects.entries()) {
    rectBuf[i * 4] = r.x
    rectBuf[i * 4 + 1] = r.y
    rectBuf[i * 4 + 2] = r.w
    rectBuf[i * 4 + 3] = r.h
    colorBuf[i * 4] = r.r
    colorBuf[i * 4 + 1] = r.g
    colorBuf[i * 4 + 2] = r.b
    colorBuf[i * 4 + 3] = r.a
  }

  return { rectBuf, colorBuf, instanceCount: rects.length }
}

function buildBaseRects(
  rects: RectInstance[],
  seq: string,
  seqStart: number,
  y: number,
  height: number,
  theme: Theme,
) {
  // eslint-disable-next-line unicorn/no-for-loop
  for (let i = 0; i < seq.length; i++) {
    const { r, g, b } = getBaseColor(seq[i]!, theme)
    rects.push({
      x: seqStart + i,
      y,
      w: 1,
      h: height,
      r,
      g,
      b,
      a: 255,
    })
  }
}

function buildTranslationRects(
  rects: RectInstance[],
  seq: string,
  seqStart: number,
  frame: Frame,
  y: number,
  height: number,
  reverse: boolean,
  colorByCDS: boolean,
  theme: Theme,
) {
  const { r: bgR, g: bgG, b: bgB } = getFrameColor(frame, colorByCDS, theme)

  // background rect spanning entire sequence
  rects.push({
    x: seqStart,
    y,
    w: seq.length,
    h: height,
    r: bgR,
    g: bgG,
    b: bgB,
    a: 255,
  })

  // compute frame alignment
  const normalizedFrame = Math.abs(frame) - 1
  const seqFrame = seqStart % 3
  const frameShift = (normalizedFrame - seqFrame + 3) % 3

  const frameShiftAdjustedSeqLength = seq.length - frameShift
  const multipleOfThreeLength =
    frameShiftAdjustedSeqLength - (frameShiftAdjustedSeqLength % 3)
  const seqSliced = seq.slice(frameShift, frameShift + multipleOfThreeLength)

  for (let i = 0; i < seqSliced.length; i += 3) {
    const codon = seqSliced.slice(i, i + 3)
    const normalizedCodon = reverse ? revcom(codon) : codon
    const upperCodon = normalizedCodon.toUpperCase()

    let codonColor: { r: number; g: number; b: number } | undefined
    if (defaultStarts.includes(upperCodon)) {
      codonColor = hexToRGB(theme.palette.startCodon)
    } else if (defaultStops.includes(upperCodon)) {
      codonColor = hexToRGB(theme.palette.stopCodon)
    }

    if (codonColor) {
      rects.push({
        x: seqStart + frameShift + i,
        y,
        w: 3,
        h: height,
        r: codonColor.r,
        g: codonColor.g,
        b: codonColor.b,
        a: 255,
      })
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

export class SequenceWebGLRenderer {
  private gl: WebGL2RenderingContext
  private program: WebGLProgram
  private vao: WebGLVertexArrayObject
  private rectBuffer: WebGLBuffer
  private colorBuffer: WebGLBuffer
  private instanceCount = 0

  private uOffsetPx: WebGLUniformLocation
  private uBpPerPx: WebGLUniformLocation
  private uCanvasWidth: WebGLUniformLocation
  private uCanvasHeight: WebGLUniformLocation

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
    this.program = createProgram(
      gl,
      SEQUENCE_VERTEX_SHADER,
      SEQUENCE_FRAGMENT_SHADER,
    )

    this.uOffsetPx = gl.getUniformLocation(this.program, 'u_offsetPx')!
    this.uBpPerPx = gl.getUniformLocation(this.program, 'u_bpPerPx')!
    this.uCanvasWidth = gl.getUniformLocation(this.program, 'u_canvasWidth')!
    this.uCanvasHeight = gl.getUniformLocation(this.program, 'u_canvasHeight')!

    this.vao = gl.createVertexArray()!
    gl.bindVertexArray(this.vao)

    this.rectBuffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.rectBuffer)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0)
    gl.vertexAttribDivisor(0, 1)

    this.colorBuffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 4, gl.UNSIGNED_BYTE, true, 0, 0)
    gl.vertexAttribDivisor(1, 1)

    gl.bindVertexArray(null)
  }

  uploadGeometry(rectBuf: Float32Array, colorBuf: Uint8Array, count: number) {
    const { gl } = this
    gl.bindBuffer(gl.ARRAY_BUFFER, this.rectBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, rectBuf, gl.STATIC_DRAW)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, colorBuf, gl.STATIC_DRAW)
    this.instanceCount = count
  }

  render(offsetPx: number, bpPerPx: number) {
    const { gl } = this
    const w = gl.canvas.width
    const h = gl.canvas.height
    gl.viewport(0, 0, w, h)
    gl.clearColor(1, 1, 1, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    if (this.instanceCount === 0) {
      return
    }

    gl.useProgram(this.program)
    gl.uniform1f(this.uOffsetPx, offsetPx)
    gl.uniform1f(this.uBpPerPx, bpPerPx)
    gl.uniform1f(this.uCanvasWidth, w)
    gl.uniform1f(this.uCanvasHeight, h)

    gl.bindVertexArray(this.vao)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.instanceCount)
    gl.bindVertexArray(null)
  }

  dispose() {
    const { gl } = this
    gl.deleteBuffer(this.rectBuffer)
    gl.deleteBuffer(this.colorBuffer)
    gl.deleteVertexArray(this.vao)
    gl.deleteProgram(this.program)
  }
}

export { codonTable }
export type { RenderSettings, SequenceRegionData }
