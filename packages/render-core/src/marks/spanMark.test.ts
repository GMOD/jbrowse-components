import { MULTI_ROW_MIN_CELL_PX } from '../shaders/rowRect.generated.ts'
import * as shader from '../shaders/spanMark.iface.generated.ts'
import { abgrToCssRgba } from './colorFill.ts'
import { spanMark } from './spanMark.ts'

import type { SpanChannels, SpanParams } from './spanMark.ts'
import type { MarkContext2D } from './types.ts'

interface FillRectCall {
  x: number
  y: number
  w: number
  h: number
  fillStyle: string
}

function mockCtx() {
  const calls: FillRectCall[] = []
  const ctx = {
    fillStyle: '',
    save() {},
    restore() {},
    beginPath() {},
    rect() {},
    clip() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    closePath() {},
    fill() {},
    fillRect(x: number, y: number, w: number, h: number) {
      calls.push({ x, y, w, h, fillStyle: this.fillStyle })
    },
  }
  return { ctx: ctx as unknown as MarkContext2D, calls }
}

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
