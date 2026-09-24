import { clipBlock } from '../blockClipUtils.ts'
import { makeBpMapper, spanLeft } from '../canvas2dUtils.ts'
import { MULTI_ROW_MIN_CELL_PX } from '../shaders/rowRect.generated.ts'
import {
  drawnRowHeightPx,
  rowBandOffsetPx,
} from '../shaders/rowRect.js.generated.ts'
import * as shader from '../shaders/spanMark.iface.generated.ts'
import { abgrToCssRgba, makeAbgrFill } from './colorFill.ts'
import { recordingContext as mockCtx } from './drawAgainstHit.ts'
import { shapeHitNearest } from './markHit.ts'
import { HIDDEN_ROW, NO_ROW_COLOR, buildRowTable } from './rowTable.ts'
import { spanMark } from './spanMark.ts'

import type { SpanChannels, SpanParams } from './spanMark.ts'
import type { MarkShape } from './types.ts'

const RED = 0xff0000ff
const BLUE = 0xffff0000

const block = {
  displayedRegionIndex: 0,
  start: 0,
  end: 100,
  screenStartPx: 0,
  screenEndPx: 1000,
  reversed: false,
}

const frame = { canvasWidth: 1000, canvasHeight: 40 }

const params: SpanParams = {
  rowHeight: 20,
  rowProportion: 1,
  minWidthPx: MULTI_ROW_MIN_CELL_PX,
  seamPx: 0,
  scrollTop: 0,
}

function channels(
  x: number[],
  x2: number[],
  row: number[],
  color: number[],
): SpanChannels {
  return {
    x: Uint32Array.from(x),
    x2: Uint32Array.from(x2),
    row: Uint32Array.from(row),
    color: Uint32Array.from(color),
    count: x.length,
  }
}

test('paints one rect per instance at its row band, genomic span and colour', () => {
  const { ctx, calls } = mockCtx()
  spanMark.paintBlock(
    ctx,
    channels([10, 50], [20, 60], [0, 1], [RED, BLUE]),
    block,
    frame,
    params,
  )
  expect(calls).toEqual([
    { x: 100, y: 0, w: 100, h: 20, fillStyle: abgrToCssRgba(RED) },
    { x: 500, y: 20, w: 100, h: 20, fillStyle: abgrToCssRgba(BLUE) },
  ])
})

// A sub-minimum span is widened by extendToMinWidth, anchored on its start edge
// exactly as the shader does. On a reversed block the start edge is the mark's
// *right* edge, so the fill must grow leftward from it; growing rightward off
// the leftmost edge instead offsets every sub-pixel mark from where the GPU
// path paints it — the zoomed-out case on a flipped region, i.e. most of the
// marks on screen.
test('sub-pixel spans widen away from their anchored start edge', () => {
  // 100bp over 50px => 0.5px/bp, so this 1bp span covers half a pixel.
  const narrow = channels([50], [51], [0], [RED])
  const draw = (reversed: boolean) => {
    const { ctx, calls } = mockCtx()
    spanMark.paintBlock(
      ctx,
      narrow,
      { ...block, screenEndPx: 50, reversed },
      frame,
      params,
    )
    return calls[0]!
  }
  expect(draw(false)).toMatchObject({ x: 25, w: MULTI_ROW_MIN_CELL_PX })
  expect(draw(true)).toMatchObject({
    x: 25 - MULTI_ROW_MIN_CELL_PX,
    w: MULTI_ROW_MIN_CELL_PX,
  })
})

test('paints nothing past the channels count', () => {
  const { ctx, calls } = mockCtx()
  const c = channels([10, 50], [20, 60], [0, 1], [RED, BLUE])
  spanMark.paintBlock(ctx, { ...c, count: 1 }, block, frame, params)
  expect(calls).toHaveLength(1)
})

// A tiling caller pads each span's right edge so two runs meeting on a
// fractional pixel leave no hairline. The pad grows rightward on both
// orientations, so reversing mirrors the spans exactly.
test('the seam pad widens a span without moving its anchor', () => {
  const seamed: SpanParams = { ...params, minWidthPx: 0, seamPx: 0.4 }
  const forward = mockCtx()
  spanMark.paintBlock(
    forward.ctx,
    channels([10], [20], [0], [RED]),
    block,
    frame,
    seamed,
  )
  expect(forward.calls[0]).toMatchObject({ x: 100, w: 100.4 })

  const back = mockCtx()
  spanMark.paintBlock(
    back.ctx,
    channels([10], [20], [0], [RED]),
    { ...block, reversed: true },
    frame,
    seamed,
  )
  expect(back.calls[0]).toMatchObject({ x: 800, w: 100.4 })
})

// The channels pack straight through: a lane is the struct field of the same
// name, so a field reordered in rowRect.slang would repack a valid buffer that
// draws the wrong picture.
test('packs x/x2/row/color into the struct lanes of the same name', () => {
  const buf = spanMark.pass.pack(
    channels([42, 1337], [99, 2000], [0, 3], [RED, BLUE]),
  )
  const u32 = new Uint32Array(buf as ArrayBuffer)
  const stride = shader.INSTANCE_STRIDE_WORDS
  expect(u32[shader.INSTANCE_OFFSET_U32.x]).toBe(42)
  expect(u32[shader.INSTANCE_OFFSET_U32.x2]).toBe(99)
  expect(u32[shader.INSTANCE_OFFSET_U32.row]).toBe(0)
  expect(u32[shader.INSTANCE_OFFSET_U32.color]).toBe(RED)
  expect(u32[stride + shader.INSTANCE_OFFSET_U32.x]).toBe(1337)
  expect(u32[stride + shader.INSTANCE_OFFSET_U32.x2]).toBe(2000)
  expect(u32[stride + shader.INSTANCE_OFFSET_U32.row]).toBe(3)
  expect(u32[stride + shader.INSTANCE_OFFSET_U32.color]).toBe(BLUE)
})

describe('the hit test derived from ink', () => {
  const all = (c: SpanChannels) =>
    Array.from({ length: c.count }, (_, i) => c.count - 1 - i)
  const hit = (
    c: SpanChannels,
    x: number,
    y: number,
    b = block,
    p = params,
    maxDistSq = Number.MIN_VALUE,
  ) => shapeHitNearest(spanMark)!(c, b, frame, p, x, y, all(c), maxDistSq)

  test('distance 0 on the painted rect, edges included, and nothing past it', () => {
    const c = channels([10, 50], [20, 60], [0, 1], [RED, BLUE])
    expect(hit(c, 150, 10)).toMatchObject({ index: 0, distSq: 0 })
    expect(hit(c, 100, 0)).toMatchObject({ index: 0, distSq: 0 })
    expect(hit(c, 200, 20)).toMatchObject({ index: 0, distSq: 0 })
    expect(hit(c, 200.5, 10)).toBeUndefined()
    expect(hit(c, 150, 20.5)).toBeUndefined()
    expect(hit(c, 550, 30)).toMatchObject({ index: 1, distSq: 0 })
  })

  test('outside, the squared distance to the nearest edge', () => {
    const c = channels([10], [20], [0], [RED])
    expect(hit(c, 203, 24, block, params, Infinity)).toMatchObject({
      index: 0,
      x: 200,
      y: 20,
      distSq: 25,
    })
  })

  test('the first zero-distance candidate wins, so back to front is on top', () => {
    const c = channels([10, 12], [20, 18], [0, 0], [RED, BLUE])
    expect(hit(c, 150, 10)?.index).toBe(1)
    expect(hit(c, 110, 10)?.index).toBe(0)
  })

  test('a sub-pixel span widens from its start edge on a reversed block', () => {
    const narrow = channels([50], [51], [0], [RED])
    const b = { ...block, screenEndPx: 50, reversed: true }
    expect(hit(narrow, 25 - MULTI_ROW_MIN_CELL_PX, 10, b)?.index).toBe(0)
    expect(hit(narrow, 25.5, 10, b)).toBeUndefined()
  })

  test('the seam pad is painter-only and not hittable', () => {
    const c = channels([10], [20], [0], [RED])
    const seamed = { ...params, minWidthPx: 0, seamPx: 0.4 }
    expect(hit(c, 200.3, 10, block, seamed)).toBeUndefined()
  })
})

const retiredSpan: Required<
  Pick<MarkShape<SpanChannels, SpanParams>, 'paintBlock' | 'ink'>
> = {
  paintBlock(ctx, channels, block, _frame, params) {
    const { x, x2, row, color, count } = channels
    const { rowHeight, rowProportion, minWidthPx, seamPx, scrollTop } = params
    const h = drawnRowHeightPx(rowHeight, rowProportion)
    const offset = rowBandOffsetPx(rowHeight, rowProportion)
    const bpToPx = makeBpMapper(block)
    const setFill = makeAbgrFill(ctx)
    for (let i = 0; i < count; i++) {
      const xa = bpToPx(x[i]!)
      const xb = bpToPx(x2[i]!)
      const width = Math.max(minWidthPx, Math.abs(xb - xa))
      setFill(color[i]!)
      ctx.fillRect(
        spanLeft(xa, xb, width),
        offset + rowHeight * row[i]! - scrollTop,
        width + seamPx,
        h,
      )
    }
  },

  ink(channels, block, _frame, params, i) {
    const { x, x2, row } = channels
    const { rowHeight, rowProportion, minWidthPx, scrollTop } = params
    const toX = makeBpMapper(block)
    const xa = toX(x[i]!)
    const xb = toX(x2[i]!)
    const width = Math.max(minWidthPx, Math.abs(xb - xa))
    return {
      left: spanLeft(xa, xb, width),
      top:
        rowBandOffsetPx(rowHeight, rowProportion) +
        rowHeight * row[i]! -
        scrollTop,
      width,
      height: drawnRowHeightPx(rowHeight, rowProportion),
    }
  },
}

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function styleRecording() {
  const recording = mockCtx()
  const styles: string[] = []
  for (const key of ['fillStyle', 'strokeStyle', 'lineWidth'] as const) {
    let value: unknown = recording.ctx[key]
    Object.defineProperty(recording.ctx, key, {
      get: () => value,
      set: (v: unknown) => {
        styles.push(`${key} ${String(v)}`)
        value = v
      },
    })
  }
  return { ...recording, styles }
}

function manySpans(regionStart: number, regionBp: number): SpanChannels {
  const rand = rng(regionBp)
  const count = 4000
  const x = new Uint32Array(count)
  const x2 = new Uint32Array(count)
  const row = new Uint32Array(count)
  const color = new Uint32Array(count)
  const palette = [RED, BLUE, 0x8033cc66, 0xff999999]
  let pick = 0
  for (let i = 0; i < count; i++) {
    const start = regionStart + Math.floor(rand() * regionBp * 1.1) - 20
    const kind = rand()
    x[i] = start
    x2[i] =
      kind < 0.05
        ? start
        : kind < 0.5
          ? start + 1 + Math.floor(rand() * 4)
          : start + Math.floor(rand() * regionBp * 0.1)
    row[i] = Math.floor(rand() * 80)
    if (rand() < 0.08) {
      pick = Math.floor(rand() * palette.length)
    }
    color[i] = palette[pick]!
  }
  return { x, x2, row, color, count }
}

describe('span places each rect as the painter it retired did', () => {
  describe.each([
    { name: 'sub-pixel', start: 1_000_000, bp: 4_000_000, px: [12.5, 987.75] },
    { name: 'zoomed in', start: 5_000, bp: 300, px: [0, 1000] },
    { name: 'clipped', start: 31_337, bp: 7_777, px: [-250.5, 1250.25] },
  ])('$name', ({ start, bp, px }) => {
    const spans = manySpans(start, bp)
    describe.each([false, true])('reversed %s', reversed => {
      const regionBlock = {
        displayedRegionIndex: 0,
        start,
        end: start + bp,
        screenStartPx: px[0]!,
        screenEndPx: px[1]!,
        reversed,
      }
      test.each<[string, SpanParams]>([
        [
          'tiling, seamed, scrolled',
          {
            rowHeight: 7,
            rowProportion: 0.75,
            minWidthPx: 0,
            seamPx: 0.4,
            scrollTop: 13.5,
          },
        ],
        [
          'floored, sub-pixel rows',
          {
            rowHeight: 0.8,
            rowProportion: 1,
            minWidthPx: MULTI_ROW_MIN_CELL_PX,
            seamPx: 0,
            scrollTop: 0,
          },
        ],
      ])('%s', (_, spanParams) => {
        const painted = styleRecording()
        spanMark.paintBlock(painted.ctx, spans, regionBlock, frame, spanParams)
        const expected = styleRecording()
        retiredSpan.paintBlock(
          expected.ctx,
          spans,
          regionBlock,
          frame,
          spanParams,
        )
        expect(painted.calls).toHaveLength(spans.count)
        expect(new Set(expected.styles).size).toBeGreaterThan(2)
        expect(painted.calls).toEqual(expected.calls)
        expect(painted.styles).toEqual(expected.styles)
        const instances = Array.from({ length: spans.count }, (_, i) => i)
        expect(
          instances.map(i =>
            spanMark.ink!(spans, regionBlock, frame, spanParams, i),
          ),
        ).toEqual(
          instances.map(i =>
            retiredSpan.ink(spans, regionBlock, frame, spanParams, i),
          ),
        )
      })
    })
  })
})

describe('a row table between the instance key and the band it draws on', () => {
  // keys 0..3: key 0 drawn on slot 2, key 1 hidden, key 2 on slot 0 in an
  // override colour, key 3 on slot 1
  const table = buildRowTable(
    Uint32Array.of(2, HIDDEN_ROW, 0, 1),
    Uint32Array.of(NO_ROW_COLOR, NO_ROW_COLOR, 0xff00ff00, NO_ROW_COLOR),
  )
  const keyed = channels(
    [10, 20, 30, 40],
    [15, 25, 35, 45],
    [0, 1, 2, 3],
    [RED, RED, RED, BLUE],
  )
  const tall = { canvasWidth: 1000, canvasHeight: 60 }
  const withTable: SpanParams = { ...params, rowTable: table }

  test('paints each key on its slot, in its override, and a hidden key nowhere', () => {
    const { ctx, calls } = mockCtx()
    spanMark.paintBlock(ctx, keyed, block, tall, withTable)
    expect(calls).toEqual([
      { x: 100, y: 40, w: 50, h: 20, fillStyle: abgrToCssRgba(RED) },
      { x: 300, y: 0, w: 50, h: 20, fillStyle: abgrToCssRgba(0xff00ff00) },
      { x: 400, y: 20, w: 50, h: 20, fillStyle: abgrToCssRgba(BLUE) },
    ])
  })

  test('the ink follows the slot, and a hidden key has none', () => {
    const ink = (i: number) => spanMark.ink!(keyed, block, tall, withTable, i)
    expect(ink(0)).toEqual({ left: 100, top: 40, width: 50, height: 20 })
    expect(ink(1)).toBeUndefined()
    expect(ink(2)).toEqual({ left: 300, top: 0, width: 50, height: 20 })
  })

  test('a key the table does not hold is hidden', () => {
    const past = channels([10], [15], [table.keys], [RED])
    const { ctx, calls } = mockCtx()
    spanMark.paintBlock(ctx, past, block, tall, withTable)
    expect(calls).toEqual([])
    expect(spanMark.ink!(past, block, tall, withTable, 0)).toBeUndefined()
  })

  test('an identity table paints what no table paints', () => {
    const identity = buildRowTable(Uint32Array.of(0, 1, 2, 3))
    const bare = mockCtx()
    spanMark.paintBlock(bare.ctx, keyed, block, tall, params)
    const tabled = mockCtx()
    spanMark.paintBlock(tabled.ctx, keyed, block, tall, {
      ...params,
      rowTable: identity,
    })
    expect(tabled.calls).toEqual(bare.calls)
    expect(bare.calls).toHaveLength(4)
  })

  test('the pass samples the table as its texture, nearest, and the uniforms say how many keys', () => {
    expect(spanMark.texture!(withTable)).toBe(table.texture)
    expect(spanMark.texture!(params)).toBeUndefined()
    expect(spanMark.pass.textures?.[0].filter).toBe('nearest')
    const clip = clipBlock(block, tall.canvasWidth, tall.canvasHeight, {
      x: 1,
      y: 1,
    })!
    const scratch = new ArrayBuffer(shader.UNIFORMS_SIZE_BYTES)
    const keys = new Int32Array(scratch)
    spanMark.writeUniforms(scratch, clip, block, tall, withTable)
    expect(keys[shader.UNIFORM_OFFSET_I32.rowTableKeys]).toBe(4)
    spanMark.writeUniforms(scratch, clip, block, tall, params)
    expect(keys[shader.UNIFORM_OFFSET_I32.rowTableKeys]).toBe(-1)
  })
})
