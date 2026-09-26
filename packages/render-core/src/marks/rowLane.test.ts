import { clipBlock } from '../blockClipUtils.ts'
import * as barShader from '../shaders/barMark.generated.ts'
import * as pointShader from '../shaders/pointMark.generated.ts'
import { barMark } from './barMark.ts'
import { abgrToCssRgba } from './colorFill.ts'
import { recordingContext } from './drawAgainstHit.ts'
import { shapeHitNearest } from './markHit.ts'
import { pointMark } from './pointMark.ts'
import { rowColor, rowSlot } from './rowLane.ts'
import { HIDDEN_ROW, NO_ROW_COLOR, buildRowTable } from './rowTable.ts'

import type { BarChannels, BarParams } from './barMark.ts'
import type { PointChannels, PointParams } from './pointMark.ts'
import type { MarkShape } from './types.ts'

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

const RED = 0xff0000ff
const GREEN = 0xff00ff00
const BLUE = 0xffff0000

const table = buildRowTable(
  Uint32Array.of(2, HIDDEN_ROW, 0, 1),
  Uint32Array.of(NO_ROW_COLOR, NO_ROW_COLOR, GREEN, NO_ROW_COLOR),
)

describe('rowSlot and rowColor read a key through the table', () => {
  const row = Uint32Array.of(0, 1, 2, 3, 4)
  const all = [0, 1, 2, 3, 4]

  test('without a table the key is the slot and the colour is the instance’s', () => {
    expect(all.map(i => rowSlot(row, i, undefined))).toEqual(all)
    expect(rowSlot(undefined, 3, undefined)).toBe(0)
    expect(rowColor(RED, row, 2, undefined)).toBe(RED)
  })

  test('with one, a key takes its slot and override, and a hidden or unknown key no slot', () => {
    expect(all.map(i => rowSlot(row, i, table))).toEqual([
      2,
      undefined,
      0,
      1,
      undefined,
    ])
    expect(rowSlot(undefined, 3, table)).toBe(2)
    expect([0, 2, 4].map(i => rowColor(RED, row, i, table))).toEqual([
      RED,
      GREEN,
      RED,
    ])
  })
})

interface TableCase<C, P> {
  shape: MarkShape<C, P>
  keyed: (row: number[], color: number[]) => C
  params: P
  inkTops: number[]
  hiddenAt: [number, number]
  keysAt: number
  uniformBytes: number
}

function describeRowTable<C, P>(c: TableCase<C, P>) {
  const { shape, keyed, params } = c
  const withTable = { ...params, rowTable: table }
  const byKey = keyed([0, 1, 2, 3], [RED, RED, RED, BLUE])
  const drawn = [0, 2, 3]
  const slotted = keyed([2, 0, 1], [RED, GREEN, BLUE])
  const hit = shapeHitNearest(shape)!
  const paint = (channels: C, p: P) => {
    const { ctx, calls } = recordingContext()
    shape.paintBlock(ctx, channels, block, frame, p)
    return calls
  }
  const ink = (channels: C, p: P, i: number) =>
    shape.ink!(channels, block, frame, p, i)
  const hitAt = (p: P, [x, y]: [number, number], maxDistSq = 16) =>
    hit(byKey, block, frame, p, x, y, [0, 1, 2, 3], maxDistSq)

  describe(`${shape.id} reads its row through a table`, () => {
    test('paints each key on its slot in its override, and the hidden key nowhere', () => {
      const calls = paint(byKey, withTable)
      expect(calls.map(r => r.fillStyle)).toEqual(
        [RED, GREEN, BLUE].map(abgrToCssRgba),
      )
      expect(calls).toEqual(paint(slotted, params))
    })

    test('the ink follows the slot, and the hidden key has none', () => {
      expect(drawn.map(i => ink(byKey, withTable, i)?.top)).toEqual(c.inkTops)
      drawn.forEach((i, j) => {
        expect(ink(byKey, withTable, i)).toEqual(ink(slotted, params, j))
      })
      expect(ink(byKey, withTable, 1)).toBeUndefined()
    })

    test('the hit test finds each key on its slot and never the hidden one', () => {
      for (const i of drawn) {
        const box = ink(byKey, withTable, i)!
        const centre: [number, number] = [
          box.left + box.width / 2,
          box.top + box.height / 2,
        ]
        expect(hitAt(withTable, centre)?.index).toBe(i)
      }
      expect(hitAt(params, c.hiddenAt)?.index).toBe(1)
      expect(hitAt(withTable, c.hiddenAt)).toBeUndefined()
    })

    test('without a table, or with an identity one, each row is its own slot', () => {
      const identity = buildRowTable(Uint32Array.of(0, 1, 2, 3))
      const bare = paint(byKey, params)
      expect(bare).toHaveLength(4)
      expect(paint(byKey, { ...params, rowTable: identity })).toEqual(bare)
    })

    test('the pass samples the table and the uniforms say how many keys', () => {
      expect(shape.textures!(withTable).rowTable).toBe(table.texture)
      expect(shape.textures!(params).rowTable).toBeUndefined()
      const clip = clipBlock(block, frame.canvasWidth, frame.canvasHeight, {
        x: 1,
        y: 1,
      })!
      const scratch = new ArrayBuffer(c.uniformBytes)
      const i32 = new Int32Array(scratch)
      shape.writeUniforms(scratch, clip, block, frame, withTable)
      expect(i32[c.keysAt]).toBe(4)
      shape.writeUniforms(scratch, clip, block, frame, params)
      expect(i32[c.keysAt]).toBe(-1)
    })
  })
}

const X = [100, 300, 500, 700]

describeRowTable<PointChannels, PointParams>({
  shape: pointMark,
  keyed: (row, color) => {
    const xs = row.length === 4 ? X : [X[0]!, X[2]!, X[3]!]
    return {
      x: Uint32Array.from(xs),
      x2: Uint32Array.from(xs, x => x + 1),
      y: new Float32Array(xs.length).fill(0.5),
      glyph: new Uint8Array(xs.length).fill(pointShader.GLYPH_SQUARE),
      row: Uint32Array.from(row),
      color: Uint32Array.from(color),
      count: xs.length,
    }
  },
  params: { ...pointParams, rowHeight: ROW_HEIGHT },
  inkTops: [246, 46, 146],
  hiddenAt: [300, 150],
  keysAt: pointShader.UNIFORM_OFFSET_I32.rowTableKeys,
  uniformBytes: pointShader.UNIFORMS_SIZE_BYTES,
})

describeRowTable<BarChannels, BarParams>({
  shape: barMark,
  keyed: (row, color) => {
    const xs = row.length === 4 ? X : [X[0]!, X[2]!, X[3]!]
    return {
      x: Uint32Array.from(xs),
      x2: Uint32Array.from(xs, x => x + 100),
      y: new Float32Array(xs.length).fill(1),
      row: Uint32Array.from(row),
      color: Uint32Array.from(color),
      count: xs.length,
    }
  },
  params: { ...barParams, rowHeight: ROW_HEIGHT },
  inkTops: [200, 0, 100],
  hiddenAt: [350, 150],
  keysAt: barShader.UNIFORM_OFFSET_I32.rowTableKeys,
  uniformBytes: barShader.UNIFORMS_SIZE_BYTES,
})
