import { clipBlock } from '@jbrowse/render-core/blockClipUtils'
import { MockHal } from '@jbrowse/render-core/hal'
import { RowKeys, buildRowTable, defineMark } from '@jbrowse/render-core/marks'
import {
  MarkTextureBinder,
  drawMarks,
  uploadMarks,
} from '@jbrowse/render-core/marks/backend'
import {
  recordingContext,
  sweepMarkAgainstHit,
} from '@jbrowse/render-core/marks/drawAgainstHit'

import {
  INSERTION_SERIF_MIN_PX_PER_BP,
  LONG_INSERTION_MIN_LENGTH,
  SERIF_H_PX,
  SERIF_HALF_W_PX,
  insertionBarWidth,
  insertionMark,
  paintInsertionLabels,
  textWidthForNumber,
} from './index.ts'
import * as shader from './shaders/insertionMark.iface.generated.ts'

import type { InsertionChannels, InsertionParams } from './index.ts'
import type { MarkFrame } from '@jbrowse/render-core/marks'

const PURPLE = 0xff800080
const PALE = 0xffeeccbb

// 100 bp over 1000 px: 10 px/bp, past the serif threshold
const block = {
  displayedRegionIndex: 0,
  start: 0,
  end: 100,
  screenStartPx: 0,
  screenEndPx: 1000,
  reversed: false,
}
const frame: MarkFrame = { canvasWidth: 1000, canvasHeight: 60 }

const params: InsertionParams = {
  rowHeight: 20,
  rowOffsetPx: 0,
  bandHeightPx: 20,
  spanFloorPx: 0,
  outline: false,
}

function channels(
  rows: { x: number; x2?: number; row?: number; length: number }[],
  extra: Partial<InsertionChannels> = {},
): InsertionChannels {
  return {
    x: Uint32Array.from(rows, r => r.x),
    x2: Uint32Array.from(rows, r => r.x2 ?? r.x),
    row: Uint32Array.from(rows, r => r.row ?? 0),
    length: Uint32Array.from(rows, r => r.length),
    color: new Uint32Array(rows.length).fill(PURPLE),
    count: rows.length,
    ...extra,
  }
}

function painted(c: InsertionChannels, p: Partial<InsertionParams> = {}) {
  const { ctx, calls } = recordingContext()
  insertionMark.paintBlock(ctx, c, block, frame, { ...params, ...p })
  return calls.map(({ x, y, w, h }) => [x, y, w, h])
}

test('an interbase marker is the bar the shader sizes, centred on its anchor', () => {
  const w = insertionBarWidth(30, 10, 20)
  expect(w).toBe(textWidthForNumber(30))
  expect(painted(channels([{ x: 50, row: 1, length: 30 }]))).toEqual([
    [500 - w / 2, 20, w, 20],
  ])
})

test('a short band shrinks a large insertion to the narrow bar', () => {
  expect(
    painted(channels([{ x: 50, length: 30 }]), { bandHeightPx: 4 }),
  ).toEqual([[497.5, 0, 5, 4]])
})

test('a small insertion wears serif caps on its row edges', () => {
  const { ctx, calls } = recordingContext()
  insertionMark.paintBlock(
    ctx,
    channels([{ x: 10, length: 3 }]),
    block,
    frame,
    params,
  )
  expect(calls.map(({ x, y, w, h }) => [x, y, w, h])).toEqual([
    [99.5, 0, 1, 20],
    [100 - SERIF_HALF_W_PX, 0, 2 * SERIF_HALF_W_PX, SERIF_H_PX],
    [100 - SERIF_HALF_W_PX, 20 - SERIF_H_PX, 2 * SERIF_HALF_W_PX, SERIF_H_PX],
  ])
})

test('no caps zoomed out past the serif threshold, nor on a long insertion', () => {
  const zoomedOut = {
    ...block,
    end: 1000 / (INSERTION_SERIF_MIN_PX_PER_BP - 0.01),
  }
  const { ctx, calls } = recordingContext()
  insertionMark.paintBlock(
    ctx,
    channels([{ x: 10, length: 3 }]),
    zoomedOut,
    frame,
    params,
  )
  expect(calls).toHaveLength(1)
  expect(
    painted(channels([{ x: 10, length: LONG_INSERTION_MIN_LENGTH }])),
  ).toHaveLength(1)
})

test('a marker on a span draws only where it outgrows the span and its floor', () => {
  // 2 bp of span is 20 px: a 30 bp insertion's 22 px box outgrows it, a
  // 3000 bp one's 34 px box too, and a 6 bp tick never does
  const c = channels([
    { x: 10, x2: 12, length: 30 },
    { x: 20, x2: 22, length: 6 },
    { x: 30, x2: 40, length: 3000 },
  ])
  expect(painted(c).map(r => r[2])).toEqual([22])
  expect(painted(c, { spanFloorPx: 25 })).toEqual([])
})

test('a marker on a hidden row draws nothing', () => {
  const keys = new RowKeys()
  const table = buildRowTable(Uint32Array.of(keys.keyOf('shown')))
  const c = channels([
    { x: 10, row: keys.keyOf('shown'), length: 30 },
    { x: 20, row: keys.keyOf('hidden'), length: 30 },
  ])
  expect(painted(c, { rowTable: table })).toHaveLength(1)
})

test('an outline goes inside a marker big enough to keep an interior', () => {
  const strokes: number[][] = []
  const { ctx } = recordingContext()
  ctx.strokeRect = (x, y, w, h) => {
    strokes.push([x, y, w, h])
  }
  const c = channels([{ x: 50, length: 30 }])
  insertionMark.paintBlock(ctx, c, block, frame, { ...params, outline: true })
  const w = textWidthForNumber(30)
  expect(strokes).toEqual([[500 - w / 2 + 0.5, 0.5, w - 1, 19]])
  strokes.length = 0
  insertionMark.paintBlock(ctx, c, block, frame, {
    ...params,
    outline: true,
    bandHeightPx: 4,
  })
  expect(strokes).toEqual([])
})

const MARK = defineMark({
  shape: insertionMark,
  channels: (c: InsertionChannels) => c,
  params: (s: MarkFrame & { p: InsertionParams }) => s.p,
})

function one(c: InsertionChannels, i: number): InsertionChannels {
  const pick = (a: Uint32Array) => Uint32Array.of(a[i]!)
  return {
    x: pick(c.x),
    x2: pick(c.x2),
    row: pick(c.row),
    length: pick(c.length),
    color: pick(c.color),
    count: 1,
  }
}

test('the hover box is the drawn marker, caps included, on both orientations', () => {
  const c = channels([
    { x: 10, row: 0, length: 3 },
    { x: 40, row: 1, length: 30 },
    { x: 70, x2: 72, row: 2, length: 3000 },
    { x: 80, x2: 90, row: 0, length: 6 },
  ])
  for (const reversed of [false, true]) {
    expect(
      sweepMarkAgainstHit(
        MARK,
        c,
        { ...block, reversed },
        { ...frame, p: params },
        { sliceOne: one, inkSlackPx: 0 },
      ),
    ).toEqual([])
  }
})

test('the GPU pass packs one instance per marker and sizes it from the uniforms', () => {
  const hal = new MockHal([MARK.pass])
  const c = channels([
    { x: 10, x2: 12, row: 3, length: 30 },
    { x: 40, row: 1, length: 7 },
  ])
  uploadMarks(hal, 0, [MARK], c)
  const uploaded = hal.getBuffer(0, 'insertion')!
  expect(uploaded.count).toBe(2)
  expect([...new Uint32Array(uploaded.data)]).toEqual([
    10,
    12,
    3,
    30,
    PURPLE,
    40,
    40,
    1,
    7,
    PURPLE,
  ])

  const state = { ...frame, p: { ...params, spanFloorPx: 2, outline: true } }
  const clip = clipBlock(block, frame.canvasWidth, frame.canvasHeight, {
    x: 1,
    y: 1,
  })!
  hal.beginFrame(0, 0, 0, 0)
  drawMarks(
    hal,
    new ArrayBuffer(hal.uniformByteSize),
    [MARK],
    block,
    clip,
    c,
    state,
    0,
    new MarkTextureBinder(hal),
  )
  hal.endFrame()
  const [draw] = hal.draws()
  expect(draw!.verticesPerInstance).toBe(shader.VERTS_PER_INSTANCE)
  const f32 = hal.uniformsOf(draw!)!
  const i32 = new Int32Array(f32.buffer, f32.byteOffset, f32.length)
  const { UNIFORM_OFFSET_F32: F, UNIFORM_OFFSET_I32: I } = shader
  expect(f32[F.pxPerBp]).toBe(10)
  expect(f32[F.bandHeightPx]).toBe(20)
  expect(f32[F.spanFloorPx]).toBe(2)
  expect(i32[I.outline]).toBe(1)
  expect(i32[I.rowTableKeys]).toBe(-1)
})

function labels(
  c: InsertionChannels,
  p: Partial<InsertionParams> = {},
  b = block,
) {
  const texts: {
    text: string
    x: number
    y: number
    fill: string
    align: string
  }[] = []
  const ctx = {
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'top' as CanvasTextBaseline,
    fillStyle: '' as string | CanvasGradient | CanvasPattern,
    fillText(text: string, x: number, y: number) {
      texts.push({
        text,
        x,
        y,
        fill: String(this.fillStyle),
        align: this.textAlign,
      })
    },
    save() {},
    restore() {},
    beginPath() {},
    rect() {},
    clip() {},
  }
  paintInsertionLabels(ctx, [b], () => c, frame, { ...params, ...p })
  return texts
}

test('a large count reads against its box in the contrast colour, not a fixed white', () => {
  expect(labels(channels([{ x: 50, length: 30 }]))).toEqual([
    { text: '30', x: 500, y: 10, fill: '#fff', align: 'center' },
  ])
  expect(
    labels(channels([{ x: 50, length: 30 }], { color: Uint32Array.of(PALE) })),
  ).toEqual([
    { text: '30', x: 500, y: 10, fill: 'rgba(0, 0, 0, 0.87)', align: 'center' },
  ])
})

test('a count on a span wider than its marker reads against `under`, or draws nowhere', () => {
  const wide = channels([{ x: 10, x2: 20, length: 3000 }])
  expect(labels(wide)).toEqual([])
  expect(labels({ ...wide, under: Uint32Array.of(PALE) })).toEqual([
    {
      text: '3000',
      x: 150,
      y: 10,
      fill: 'rgba(0, 0, 0, 0.87)',
      align: 'center',
    },
  ])
})

test('a small insertion at base level gets (N) beside its bar', () => {
  expect(labels(channels([{ x: 50, length: 3 }]))).toEqual([
    { text: '(3)', x: 503, y: 10, fill: 'rgba(128,0,128,1)', align: 'left' },
  ])
})

test('no count in a band too short for letters', () => {
  expect(
    labels(channels([{ x: 50, length: 30 }]), { bandHeightPx: 4 }),
  ).toEqual([])
})
