import { clipBlock } from '../blockClipUtils.ts'
import { barPass, barShader, barUniforms, paintBars } from './bar.ts'

import type { RenderBlock } from '../renderBlock.ts'
import type { BarContext2D } from './bar.ts'

interface Payload {
  starts: Uint32Array
  ends: Uint32Array
  scores: Float32Array
}

const encoding = {
  x: (d: Payload) => d.starts,
  x2: (d: Payload) => d.ends,
  y: (d: Payload) => d.scores,
}

function payload(starts: number[], ends: number[], scores: number[]): Payload {
  return {
    starts: new Uint32Array(starts),
    ends: new Uint32Array(ends),
    scores: new Float32Array(scores),
  }
}

const block: RenderBlock = {
  displayedRegionIndex: 0,
  start: 0,
  end: 1000,
  screenStartPx: 0,
  screenEndPx: 1000,
  reversed: false,
}

function mockCtx() {
  const rects: [number, number, number, number][] = []
  const ctx: BarContext2D = {
    fillStyle: '',
    save() {},
    restore() {},
    beginPath() {},
    rect() {},
    clip() {},
    fillRect(x, y, w, h) {
      rects.push([x, y, w, h])
    },
  }
  return { ctx, rects }
}

const frame = { canvasWidth: 1000, canvasHeight: 100, color: '#0068d1' }

test('paints one box per instance, height proportional to y', () => {
  const { ctx, rects } = mockCtx()
  paintBars(
    ctx,
    new Map([[0, payload([100], [200], [0.5])]]),
    [block],
    frame,
    encoding,
  )
  expect(rects).toHaveLength(1)
  const [x, y, w, h] = rects[0]!
  expect(x).toBeCloseTo(100)
  expect(w).toBeCloseTo(100)
  expect(h).toBeCloseTo(50)
  expect(y).toBeCloseTo(50)
})

test('paints nothing for a region with no payload', () => {
  const { ctx, rects } = mockCtx()
  paintBars(ctx, new Map(), [block], frame, encoding)
  expect(rects).toHaveLength(0)
})

test('widens a sub-pixel bar to 1px so it still paints', () => {
  const { ctx, rects } = mockCtx()
  paintBars(
    ctx,
    new Map([[0, payload([500], [500], [1])]]),
    [block],
    frame,
    encoding,
  )
  expect(rects[0]![2]).toBe(1)
})

test('packs x / x2 / y at the offsets the shader expects', () => {
  const buf = barPass(encoding).pack(
    payload([42, 1337], [99, 2000], [0.5, 0.25]),
  )
  const u32 = new Uint32Array(buf as ArrayBuffer)
  const f32 = new Float32Array(buf as ArrayBuffer)
  const stride = barShader.INSTANCE_STRIDE_WORDS
  expect(u32[barShader.INSTANCE_OFFSET_U32.x]).toBe(42)
  expect(u32[barShader.INSTANCE_OFFSET_U32.x2]).toBe(99)
  expect(f32[barShader.INSTANCE_OFFSET_F32.y]).toBeCloseTo(0.5)
  expect(u32[stride + barShader.INSTANCE_OFFSET_U32.x]).toBe(1337)
  expect(f32[stride + barShader.INSTANCE_OFFSET_F32.y]).toBeCloseTo(0.25)
  expect(buf.byteLength).toBe(2 * barShader.INSTANCE_STRIDE_BYTES)
})

test('preserves uint32 positions above the float32-safe range', () => {
  const bigPos = 250_000_001
  const buf = barPass(encoding).pack(payload([bigPos], [bigPos + 1], [1]))
  expect(
    new Uint32Array(buf as ArrayBuffer)[barShader.INSTANCE_OFFSET_U32.x],
  ).toBe(bigPos)
})

// Reversal is baked into bpRangeX's negated length rather than a reversed
// flag the shader branches on.
function bpRangeLen(reversed: boolean) {
  const b = { ...block, screenEndPx: 800, reversed }
  const clip = clipBlock(b, 800, 100, { x: 1, y: 1 })!
  return barUniforms(b, clip, { canvasWidth: 800, canvasHeight: 100, color: 0 })
    .bpRangeX[2]
}

test('a forward block writes a positive bpRangeX length', () => {
  expect(bpRangeLen(false)).toBeGreaterThan(0)
})

test('a reversed block writes a negated bpRangeX length', () => {
  expect(bpRangeLen(true)).toBeLessThan(0)
})
