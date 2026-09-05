import { clipBlock } from '@jbrowse/render-core/blockClipUtils'
import { MockHal } from '@jbrowse/render-core/hal'
import * as shader from '@jbrowse/render-core/shaders/pointMarkIface'

import { MANHATTAN_MARKS } from './manhattanMarks.ts'

import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type { ManhattanRenderState } from './manhattanRenderingBackendTypes.ts'

Object.defineProperty(globalThis, 'devicePixelRatio', {
  value: 1,
  writable: true,
  configurable: true,
})

const MARK = MANHATTAN_MARKS[0]!

function mkData(
  positions: number[],
  scores: number[],
  colors: number[],
  ends: number[] = positions,
  glyphs: number[] = positions.map(() => 0),
): ManhattanRpcResult {
  return {
    positions: new Uint32Array(positions),
    ends: new Uint32Array(ends),
    glyphs: new Uint8Array(glyphs),
    scores: new Float32Array(scores),
    colors: new Uint32Array(colors),
    numFeatures: positions.length,
    scoreMin: Math.min(...scores),
    scoreMax: Math.max(...scores),
    flatbushData: undefined,
  }
}

// The declaration's own claim: which of this display's arrays reach which of
// the shape's lanes. The shape owns the byte layout — a lane swap here would
// pack a valid buffer that draws the wrong picture, which no shader-side test
// can see.
test('the declaration feeds positions/ends/scores/colors/glyphs to x/x2/y/color/glyph', () => {
  const buf = MARK.pass.pack(
    mkData(
      [42, 1337],
      [0.5, 7.25],
      [0xff0000ff, 0xff00ff00],
      [99, 2000],
      [0, 1],
    ),
  )
  const u32 = new Uint32Array(buf as ArrayBuffer)
  const f32 = new Float32Array(buf as ArrayBuffer)
  const stride = shader.INSTANCE_STRIDE_WORDS

  expect(u32[shader.INSTANCE_OFFSET_U32.x]).toBe(42)
  expect(u32[shader.INSTANCE_OFFSET_U32.x2]).toBe(99)
  expect(f32[shader.INSTANCE_OFFSET_F32.y]).toBeCloseTo(0.5)
  expect(u32[shader.INSTANCE_OFFSET_U32.color]).toBe(0xff0000ff)
  expect(u32[shader.INSTANCE_OFFSET_U32.glyph]).toBe(0)

  expect(u32[stride + shader.INSTANCE_OFFSET_U32.x]).toBe(1337)
  expect(u32[stride + shader.INSTANCE_OFFSET_U32.x2]).toBe(2000)
  expect(f32[stride + shader.INSTANCE_OFFSET_F32.y]).toBeCloseTo(7.25)
  expect(u32[stride + shader.INSTANCE_OFFSET_U32.color]).toBe(0xff00ff00)
  expect(u32[stride + shader.INSTANCE_OFFSET_U32.glyph]).toBe(1)
})

test('produces a buffer sized to numFeatures × stride', () => {
  const buf = MARK.pass.pack(mkData([1, 2, 3], [0, 0, 0], [0, 0, 0]))
  expect(buf.byteLength).toBe(3 * shader.INSTANCE_STRIDE_BYTES)
})

test('preserves uint32 positions above the float32-safe range', () => {
  // chr1 ≈ 250 Mbp; bigger than 2^24 — would lose precision if stored as f32.
  const bigPos = 250_000_001
  const buf = MARK.pass.pack(mkData([bigPos], [1], [0]))
  expect(
    new Uint32Array(buf as ArrayBuffer)[shader.INSTANCE_OFFSET_U32.x],
  ).toBe(bigPos)
})

describe('reversed convention', () => {
  const state: ManhattanRenderState = {
    domainY: [0, 10],
    canvasWidth: 800,
    canvasHeight: 400,
    pointDiameterPx: 4,
  }
  const block = {
    displayedRegionIndex: 0,
    start: 0,
    end: 1000,
    screenStartPx: 0,
    screenEndPx: 800,
    reversed: false,
  }

  function bpRangeLen(reversed: boolean) {
    const hal = new MockHal([MARK.pass])
    const scratch = new ArrayBuffer(MARK.pass.uniformByteSize)
    const data = mkData([500], [5], [0xff0000ff])
    const b = { ...block, reversed }
    const clip = clipBlock(b, state.canvasWidth, state.canvasHeight, {
      x: 1,
      y: 1,
    })!
    MARK.drawRegion(hal, scratch, b, clip, data, state)
    return hal.getLastUniformsF32()![shader.UNIFORM_OFFSET_F32.bpRangeX + 2]!
  }

  // Reversal is baked into bpRangeX's negated length (no separate `reversed`
  // uniform + shader flip, which double-flipped reversed points to the forward
  // orientation). Forward → positive length, reversed → negative.
  test('forward block writes a positive bpRangeX length', () => {
    expect(bpRangeLen(false)).toBeGreaterThan(0)
  })
  test('reversed block writes a negated bpRangeX length', () => {
    expect(bpRangeLen(true)).toBeLessThan(0)
  })
})
