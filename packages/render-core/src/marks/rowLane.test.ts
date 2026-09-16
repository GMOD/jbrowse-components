import * as barShader from '../shaders/barMark.generated.ts'
import * as pointShader from '../shaders/pointMark.generated.ts'
import { barMark } from './barMark.ts'
import { pointMark } from './pointMark.ts'

import type { BarChannels } from './barMark.ts'
import type { PointChannels } from './pointMark.ts'

const block = {
  displayedRegionIndex: 0,
  start: 0,
  end: 1000,
  screenStartPx: 0,
  screenEndPx: 1000,
  reversed: false,
}
const CANVAS_HEIGHT = 300
const frame = { canvasWidth: 1000, canvasHeight: CANVAS_HEIGHT }
const ROW_HEIGHT = 100

// three instances, one per row, every value the domain's top
const bars: BarChannels = {
  x: Uint32Array.from([100, 400, 700]),
  x2: Uint32Array.from([200, 500, 800]),
  y: Float32Array.from([1, 1, 1]),
  row: Uint32Array.from([0, 1, 2]),
  color: new Uint32Array(3),
  count: 3,
}
const barParams = {
  domain: [0, 1] as [number, number],
  origin: 0,
  minWidthPx: 0,
  seamPx: 0,
}

const points: PointChannels = {
  ...bars,
  glyph: new Uint8Array(3),
}
const pointParams = { domain: [0, 1] as [number, number], diameterPx: 8 }

test('a bar in row r stands on the baseline of band r, the scale ruling the band', () => {
  for (let i = 0; i < 3; i++) {
    const ink = barMark.ink!(
      bars,
      block,
      frame,
      { ...barParams, rowHeight: ROW_HEIGHT },
      i,
    )!
    expect(ink.top).toBe(i * ROW_HEIGHT)
    expect(ink.height).toBe(ROW_HEIGHT)
  }
})

test('a point in row r is centred on its value inside band r', () => {
  for (let i = 0; i < 3; i++) {
    const ink = pointMark.ink!(
      points,
      block,
      frame,
      { ...pointParams, rowHeight: ROW_HEIGHT },
      i,
    )!
    expect(ink.top + ink.height / 2).toBe(i * ROW_HEIGHT)
  }
})

test('no rows is row 0 over the whole canvas, so a rowless caller draws as it did', () => {
  const rowless: BarChannels = { ...bars, row: undefined }
  const rowZero: BarChannels = { ...bars, row: new Uint32Array(3) }
  const canvasBand = { ...barParams, rowHeight: CANVAS_HEIGHT }
  for (let i = 0; i < 3; i++) {
    expect(barMark.ink!(rowless, block, frame, barParams, i)).toEqual(
      barMark.ink!(rowZero, block, frame, canvasBand, i),
    )
  }
  const rowlessPoints: PointChannels = { ...points, row: undefined }
  const rowZeroPoints: PointChannels = { ...points, row: new Uint32Array(3) }
  expect(pointMark.ink!(rowlessPoints, block, frame, pointParams, 2)).toEqual(
    pointMark.ink!(
      rowZeroPoints,
      block,
      frame,
      { ...pointParams, rowHeight: CANVAS_HEIGHT },
      2,
    ),
  )
})

test('the instance record carries the row, zero where the caller sent none', () => {
  const packed = new Uint32Array(barMark.pass.pack(bars) as ArrayBuffer)
  const rowAt = (i: number) =>
    packed[
      i * barShader.INSTANCE_STRIDE_WORDS + barShader.INSTANCE_OFFSET_U32.row
    ]
  expect([rowAt(0), rowAt(1), rowAt(2)]).toEqual([0, 1, 2])
  const rowless = new Uint32Array(
    pointMark.pass.pack({ ...points, row: undefined }) as ArrayBuffer,
  )
  expect(rowless.length).toBe(3 * pointShader.INSTANCE_STRIDE_WORDS)
  expect(
    rowless[
      2 * pointShader.INSTANCE_STRIDE_WORDS +
        pointShader.INSTANCE_OFFSET_U32.row
    ],
  ).toBe(0)
})
