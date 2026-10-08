import { clipBlock } from '../blockClipUtils.ts'
import * as center from '../shaders/lineCenterMark.iface.generated.ts'
import { GAP_Y, NO_PREV_X } from '../shaders/lineCommon.generated.ts'
import * as step from '../shaders/lineStepMark.iface.generated.ts'
import { abgrToCssRgba } from './colorFill.ts'
import { recordingContext as mockCtx } from './drawAgainstHit.ts'
import { lineCenterMark, lineMarkOf, lineStepMark } from './lineMark.ts'
import { HIDDEN_ROW, NO_ROW_COLOR, buildRowTable } from './rowTable.ts'

import type { LineChannels, LineParams } from './lineMark.ts'

const RED = 0xff0000ff
const BLUE = 0xffff0000

// 100 bp over 1000 px: 10 px a base.
const block = {
  displayedRegionIndex: 0,
  start: 0,
  end: 100,
  screenStartPx: 0,
  screenEndPx: 1000,
  reversed: false,
}

const frame = { canvasWidth: 1000, canvasHeight: 100 }

const params: LineParams = {
  domain: [0, 10],
  origin: 0,
  lineWidth: 2,
}

function channels(
  rows: { x: number; x2: number; y: number; row?: number; color?: number }[],
  gapBp?: number,
): LineChannels {
  return {
    x: Uint32Array.from(rows, r => r.x),
    x2: Uint32Array.from(rows, r => r.x2),
    y: Float32Array.from(rows, r => r.y),
    row: Uint32Array.from(rows, r => r.row ?? 0),
    color: Uint32Array.from(rows, r => r.color ?? RED),
    count: rows.length,
    ...(gapBp === undefined ? {} : { gapBp }),
  }
}

// Three abutting spans, then a gap, then one more: one run of three and a
// run of one.
const stepped = channels([
  { x: 10, x2: 20, y: 2 },
  { x: 20, x2: 30, y: 6 },
  { x: 30, x2: 40, y: 4 },
  { x: 60, x2: 70, y: 8 },
])

// The f32 lane holds the sentinel as float32.
const GAP = Math.fround(GAP_Y)

// Painted px to the thousandth, since a value's y goes through the scale.
function px(calls: readonly { x: number; y: number; w: number; h: number }[]) {
  return calls.map(c =>
    [c.x, c.y, c.w, c.h].map(v => Math.round(v * 1000) / 1000),
  )
}

function u32(buf: ArrayBufferLike, stride: number, i: number, word: number) {
  return new Uint32Array(buf as ArrayBuffer)[i * stride + word]!
}

function f32(buf: ArrayBufferLike, stride: number, i: number, word: number) {
  return new Float32Array(buf as ArrayBuffer)[i * stride + word]!
}

test('the step record carries each abutting neighbour and a gap sentinel otherwise', () => {
  const buf = lineStepMark.pass.pack(stepped) as ArrayBuffer
  expect(buf.byteLength).toBe(4 * step.INSTANCE_STRIDE_BYTES)
  const words = step.INSTANCE_STRIDE_WORDS
  const prev = (i: number) => f32(buf, words, i, step.INSTANCE_OFFSET_F32.prevY)
  const next = (i: number) => f32(buf, words, i, step.INSTANCE_OFFSET_F32.nextY)
  expect([prev(0), prev(1), prev(2), prev(3)]).toEqual([GAP, 2, 6, GAP])
  // a joined next collapses onto the next instance's rise, so it is the
  // instance's own value; a gap after drops to the origin
  expect([next(0), next(1), next(2), next(3)]).toEqual([2, 6, GAP, GAP])
  expect(u32(buf, words, 1, step.INSTANCE_OFFSET_U32.color)).toBe(RED)
})

test('a row change breaks a step run even where the spans abut', () => {
  const buf = lineStepMark.pass.pack(
    channels([
      { x: 10, x2: 20, y: 2, row: 0 },
      { x: 20, x2: 30, y: 6, row: 1 },
    ]),
  ) as ArrayBuffer
  const words = step.INSTANCE_STRIDE_WORDS
  expect(f32(buf, words, 1, step.INSTANCE_OFFSET_F32.prevY)).toBe(GAP)
  expect(f32(buf, words, 0, step.INSTANCE_OFFSET_F32.nextY)).toBe(GAP)
})

test('the linear record links each instance to the previous one on its row within the gap', () => {
  const buf = lineCenterMark.pass.pack(
    channels(
      [
        { x: 10, x2: 20, y: 2 },
        { x: 20, x2: 30, y: 6 },
        { x: 60, x2: 70, y: 8 },
      ],
      25,
    ),
  ) as ArrayBuffer
  expect(buf.byteLength).toBe(3 * center.INSTANCE_STRIDE_BYTES)
  const words = center.INSTANCE_STRIDE_WORDS
  const prevX = (i: number) =>
    u32(buf, words, i, center.INSTANCE_OFFSET_U32.prevX)
  expect([prevX(0), prevX(1), prevX(2)]).toEqual([NO_PREV_X, 10, NO_PREV_X])
  expect(f32(buf, words, 1, center.INSTANCE_OFFSET_F32.prevY)).toBe(2)
  // no gap declared: one run per row
  const joined = lineCenterMark.pass.pack(
    channels([
      { x: 10, x2: 20, y: 2 },
      { x: 60, x2: 70, y: 8 },
    ]),
  ) as ArrayBuffer
  expect(u32(joined, words, 1, center.INSTANCE_OFFSET_U32.prevX)).toBe(10)
})

test('the step painter strokes a rise, the tops, the steps and a drop at each gap', () => {
  const { ctx, calls } = mockCtx()
  lineStepMark.paintBlock(ctx, stepped, block, frame, params)
  // y: value 0 at 100 px, 10 at 0 px; each edge a box `lineWidth` wide
  expect(px(calls)).toEqual([
    [99, 79, 2, 22], // rise from the origin at x 100 to y 2 (80 px)
    [99, 79, 102, 2], // top of the first span
    [199, 39, 2, 42], // step up to 6 (40 px) at the shared edge
    [199, 39, 102, 2],
    [299, 39, 2, 22], // step down to 4 (60 px)
    [299, 59, 102, 2],
    [399, 59, 2, 42], // drop to the origin at the gap
    [599, 19, 2, 82], // the second run rises from the origin
    [599, 19, 102, 2],
    [699, 19, 2, 82],
  ])
  expect(calls.every(c => c.fillStyle === abgrToCssRgba(RED))).toBe(true)
})

test("the step's ink is each instance's rise, top and drop", () => {
  const ink = (i: number) => lineStepMark.ink!(stepped, block, frame, params, i)
  expect(ink(0)).toEqual({ left: 99, top: 79, width: 102, height: 22 })
  expect(ink(1)).toEqual({ left: 199, top: 39, width: 102, height: 42 })
  expect(ink(2)).toEqual({ left: 299, top: 39, width: 102, height: 62 })
  expect(ink(3)).toMatchObject({ left: 599, width: 102 })
  expect(ink(3)!.top).toBeCloseTo(19)
  expect(ink(3)!.height).toBeCloseTo(82)
})

test('the linear painter joins midpoints on a row and dots a run start', () => {
  const c = channels(
    [
      { x: 10, x2: 20, y: 2 },
      { x: 20, x2: 30, y: 6 },
      { x: 60, x2: 70, y: 8 },
    ],
    25,
  )
  const { ctx, calls } = mockCtx()
  lineCenterMark.paintBlock(ctx, c, block, frame, params)
  expect(px(calls)).toEqual([
    [149, 79, 2, 2], // the run's first midpoint, a dot
    [149, 39, 102, 42], // to the second midpoint at 250, 40
    [649, 19, 2, 2], // past the gap, a new run's dot
  ])
  expect(lineCenterMark.ink!(c, block, frame, params, 1)).toEqual({
    left: 149,
    top: 39,
    width: 102,
    height: 42,
  })
  const dot = lineCenterMark.ink!(c, block, frame, params, 2)!
  expect([dot.left, dot.width, dot.height]).toEqual([649, 2, 2])
  expect(dot.top).toBeCloseTo(19)
})

test('a row the table hides paints nothing, has no ink and breaks the run around it', () => {
  const c = channels([
    { x: 10, x2: 20, y: 2, row: 0 },
    { x: 20, x2: 30, y: 6, row: 1 },
    { x: 30, x2: 40, y: 4, row: 0 },
  ])
  const table = buildRowTable(
    Uint32Array.of(0, HIDDEN_ROW),
    Uint32Array.of(NO_ROW_COLOR, NO_ROW_COLOR),
  )
  const banded: LineParams = { ...params, rowHeight: 50, rowTable: table }
  const { ctx, calls } = mockCtx()
  lineStepMark.paintBlock(ctx, c, block, frame, banded)
  expect(calls.every(r => r.y < 50)).toBe(true)
  expect(lineStepMark.ink!(c, block, frame, banded, 1)).toBeUndefined()
  expect(lineStepMark.ink!(c, block, frame, banded, 2)).toBeDefined()
})

test('a row color override paints the row', () => {
  const c = channels([{ x: 10, x2: 20, y: 2, row: 0 }])
  const table = buildRowTable(Uint32Array.of(0), Uint32Array.of(BLUE))
  const { ctx, calls } = mockCtx()
  lineStepMark.paintBlock(ctx, c, block, frame, { ...params, rowTable: table })
  expect(calls[0]!.fillStyle).toBe(abgrToCssRgba(BLUE))
})

test('interpolate picks the variant', () => {
  expect(lineMarkOf('step')).toBe(lineStepMark)
  expect(lineMarkOf('linear')).toBe(lineCenterMark)
})

test('under a threshold a step is stroked once per band, a rise across the cut changing color at it', () => {
  const c = channels([
    { x: 10, x2: 20, y: 2 },
    { x: 20, x2: 30, y: 8 },
  ])
  c.colorValue = c.y
  const { ctx, calls } = mockCtx()
  lineStepMark.paintBlock(ctx, c, block, frame, {
    ...params,
    colorScale: { cuts: [5], colors: Uint32Array.of(RED, BLUE) },
    colorFromY: true,
  })
  const red = abgrToCssRgba(RED)
  const blue = abgrToCssRgba(BLUE)
  expect(calls.map(r => [r.fillStyle, ...px([r])[0]!])).toEqual([
    // below the cut at y 5 (50 px): the first rise, the first top, and the
    // lower halves of the joint's rise and the final drop
    [red, 99, 79, 2, 22],
    [red, 99, 79, 102, 2],
    [red, 199, 49, 2, 32],
    [red, 299, 49, 2, 52],
    // above it: the upper halves and the second top
    [blue, 199, 19, 2, 32],
    [blue, 199, 19, 102, 2],
    [blue, 299, 19, 2, 32],
  ])
})

test('a threshold over another field colors each instance by its own value', () => {
  const c = channels([
    { x: 10, x2: 20, y: 9 },
    { x: 20, x2: 30, y: 9 },
  ])
  c.colorValue = Float32Array.of(0, 100)
  const { ctx, calls } = mockCtx()
  lineStepMark.paintBlock(ctx, c, block, frame, {
    ...params,
    colorScale: { cuts: [50], colors: Uint32Array.of(RED, BLUE) },
  })
  const tops = calls.filter(r => r.w > 50)
  expect(tops.map(r => r.fillStyle)).toEqual([
    abgrToCssRgba(RED),
    abgrToCssRgba(BLUE),
  ])
})

test('along y, a row the table recolors paints its override', () => {
  const c = channels([
    { x: 10, x2: 20, y: 2 },
    { x: 20, x2: 30, y: 8 },
  ])
  c.colorValue = c.y
  const GREEN = 0xff00ff00
  const table = buildRowTable(Uint32Array.of(0), Uint32Array.of(GREEN))
  const { ctx, calls } = mockCtx()
  lineStepMark.paintBlock(ctx, c, block, frame, {
    ...params,
    colorScale: { cuts: [5], colors: Uint32Array.of(RED, BLUE) },
    colorFromY: true,
    rowTable: table,
  })
  expect(new Set(calls.map(r => r.fillStyle))).toEqual(
    new Set([abgrToCssRgba(GREEN)]),
  )
})

test('the uniforms say whether the color field is the plotted y', () => {
  const clip = clipBlock(block, frame.canvasWidth, frame.canvasHeight, {
    x: 1,
    y: 1,
  })!
  const colorFromY = (p: LineParams) => {
    const scratch = new ArrayBuffer(step.UNIFORMS_SIZE_BYTES)
    lineStepMark.writeUniforms(scratch, clip, block, frame, p)
    return new Int32Array(scratch)[step.UNIFORM_OFFSET_I32.colorFromY]
  }
  expect(colorFromY(params)).toBe(0)
  expect(colorFromY({ ...params, colorFromY: true })).toBe(1)
})
