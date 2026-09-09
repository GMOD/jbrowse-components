import { MULTI_ROW_MIN_CELL_PX } from '../shaders/rowRect.generated.ts'
import * as shader from '../shaders/spanMark.iface.generated.ts'
import { abgrToCssRgba } from './colorFill.ts'
import { recordingContext as mockCtx } from './drawAgainstHit.ts'
import { shapeHitNearest } from './markHit.ts'
import { spanMark } from './spanMark.ts'

import type { SpanChannels, SpanParams } from './spanMark.ts'

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
